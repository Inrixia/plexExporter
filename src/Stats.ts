import got from "got";

type Account = {
	id: number;
	key: `/accounts/${number}`;
	name: string;
	defaultAudioLanguage: string;
	autoSelectAudio: boolean;
	defaultSubtitleLanguage: string;
	subtitleMode: number;
	thumb: `https://plex.tv/users/${number}/avatar?c=${number}`;
};
type Device = {
	id: number;
	name: string;
	platform: string;
	clientIdentifier: string;
	createdAt: number;
};
type StatisticsBandwidth = {
	accountID: number;
	deviceID: number;
	timespan: number;
	at: number;
	lan: boolean;
	bytes: number;
};

type JsonResponse = {
	MediaContainer: {
		size: number;
		Device: Device[];
		Account: Account[];
		StatisticsBandwidth: StatisticsBandwidth[];
	};
};

type Labels = {
	// Account info
	accountName: string;
	accountId: string;
	// Device info
	deviceId: string;
	deviceName: string;
	devicePlatform: string;
	clientIdentifier: string;
	// Data info
	net: string;
};

type AccountCache = { [accountId: string]: Account["name"] };
type DeviceCache = {
	[deviceId: string]: {
		name: string;
		platform: string;
		clientIdentifier: string;
	};
};

class Sample {
	public readonly labels: Labels;

	public readonly lan: boolean;
	public readonly at: number;
	public readonly accountId: number;
	public readonly deviceId: number;
	public bytes: number;

	constructor(stat: StatisticsBandwidth, accountCache: AccountCache, deviceCache: DeviceCache) {
		this.lan = stat.lan;
		this.at = stat.at;
		this.accountId = stat.accountID;
		this.deviceId = stat.deviceID;
		this.bytes = stat.bytes;

		this.labels = {
			// Account info
			accountName: accountCache[stat.accountID],
			accountId: stat.accountID.toString(),
			// Device info
			deviceId: stat.deviceID.toString(),
			deviceName: deviceCache[stat.deviceID].name,
			devicePlatform: deviceCache[stat.deviceID].platform,
			clientIdentifier: deviceCache[stat.deviceID].clientIdentifier,
			// Net info
			net: stat.lan ? "lan" : "wan",
		};
	}

	get uid() {
		return `${this.accountId}:${this.deviceId}`;
	}
}

// Global caches
const lastSentStatTimetamps: { [uid: string]: number } = {};

export const getStats = async (token: string, url: string) => {
	const getMediaContainer = async (timespan: number) => {
		const { MediaContainer } = await got.get<JsonResponse>({
			responseType: "json",
			resolveBodyOnly: true,
			https: { rejectUnauthorized: false },
			method: "GET",
			url: `${url}/statistics/bandwidth`,
			searchParams: {
				timespan,
				"X-Plex-Token": token,
				"X-Plex-Device-Name": "PrometheusExporter",
				"X-Plex-Device": "Node",
				"X-Plex-Platform": "Node",
				// Fixed UUID4 for this app
				"X-Plex-Client-Identifier": "9b60b49b-8158-4402-ad78-2f48eb4e7476",
			},
			headers: {
				Accept: "application/json",
			},
		});

		const accountCache: AccountCache = {};
		for (const account of MediaContainer.Account) {
			accountCache[account.id] = account.name;
		}

		const deviceCache: DeviceCache = {};
		for (const device of MediaContainer.Device) {
			deviceCache[device.id] = {
				name: device.name,
				platform: device.platform,
				clientIdentifier: device.clientIdentifier,
			};
		}
		return MediaContainer.StatisticsBandwidth.map((stat) => new Sample(stat, accountCache, deviceCache));
	};

	const fixBadAccounts = (samples: Sample[]) => {
		const isRemoteUser = (sample: Sample) => !sample.lan && sample.accountId !== 1;

		// Build a hash of all remote user samples
		const remoteUserSamples: Record<`${number}-${number}`, Sample> = {};
		for (const remoteSample of samples) {
			if (isRemoteUser(remoteSample)) {
				remoteUserSamples[`${remoteSample.deviceId}-${remoteSample.at}`] = remoteSample;
			}
		}

		const isOwnerWan = (sample: Sample) => !sample.lan && sample.accountId === 1;

		const filteredSamples: Sample[] = [];
		for (let i = 0; i < samples.length; i++) {
			const ownerWanSample = samples[i];
			// Only work on the owner user
			if (isOwnerWan(ownerWanSample)) {
				const remoteUserSample = remoteUserSamples[`${ownerWanSample.deviceId}-${ownerWanSample.at}`];
				if (remoteUserSample) {
					remoteUserSample.bytes = ownerWanSample.bytes;
					// Dont include bad ownerWanSamples in filteredSamples
					continue;
				}
			}
			filteredSamples.push(ownerWanSample);
		}

		return filteredSamples;
	};

	const latestSamples = fixBadAccounts(await getMediaContainer(6));

	const isNewSample = ({ uid, at }: Sample) => {
		if (lastSentStatTimetamps[uid] === undefined) {
			lastSentStatTimetamps[uid] = at;
			return true;
		}
		if (at > lastSentStatTimetamps[uid]) return true;
		return false;
	};

	const maxAts: Record<string, number> = {};
	const updateMaxSample = ({ uid, at }: Sample) => {
		maxAts[uid] ??= at;
		maxAts[uid] = at > maxAts[uid] ? at : maxAts[uid];
	};

	for (const sample of latestSamples) {
		if (isNewSample(sample)) updateMaxSample(sample);
	}

	// Filter only the newest unseen samples
	return latestSamples.filter((sample) => {
		if (maxAts[sample.uid] === sample.at) {
			lastSentStatTimetamps[sample.uid] = sample.at;
			return true;
		}
		return false;
	});
};
