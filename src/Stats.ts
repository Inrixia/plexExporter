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

type AccountCache = { [accountId: string]: Account["name"] };
type DeviceCache = {
	[deviceId: string]: {
		name: string;
		platform: string;
		clientIdentifier: string;
	};
};

export class Sample {
	public static readonly LabelNames = [
		"accountName",
		"accountId",
		"originalAccountName",
		"originalAccountId",
		"deviceId",
		"deviceName",
		"devicePlatform",
		"clientIdentifier",
		"net",
	] as const;
	private accountCache: AccountCache;
	private deviceCache: DeviceCache;

	public readonly lan: boolean;
	public readonly at: number;
	public readonly deviceId: number;
	public bytes: number;

	private originalAccountId?: number;
	private _accountId: number;

	constructor(stat: StatisticsBandwidth, accountCache: AccountCache, deviceCache: DeviceCache) {
		this.lan = stat.lan;
		this.at = stat.at;
		this._accountId = stat.accountID;
		this.deviceId = stat.deviceID;
		this.bytes = stat.bytes;

		this.accountCache = accountCache;
		this.deviceCache = deviceCache;
	}

	get accountId(): number {
		return this._accountId;
	}
	set accountId(accountId: number) {
		this.originalAccountId = this._accountId;
		this._accountId = accountId;
	}

	get labels() {
		const labels: Partial<Record<typeof Sample["LabelNames"][number], string>> = {
			// Account info
			accountName: this.accountCache[this.accountId],
			accountId: this.accountId.toString(),
			// Device info
			deviceId: this.deviceId.toString(),
			deviceName: this.deviceCache[this.deviceId].name,
			devicePlatform: this.deviceCache[this.deviceId].platform,
			clientIdentifier: this.deviceCache[this.deviceId].clientIdentifier,
			// Net info
			net: this.lan ? "lan" : "wan",
		};
		// Original info
		if (this.originalAccountId !== undefined) labels.originalAccountName = this.accountCache[this.originalAccountId];
		if (this.originalAccountId !== undefined) labels.originalAccountId = this.originalAccountId.toString();
		return labels;
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

		return samples.map((ownerWanSample) => {
			// Only work on the owner user
			if (isOwnerWan(ownerWanSample)) {
				const remoteUserSample = remoteUserSamples[`${ownerWanSample.deviceId}-${ownerWanSample.at}`];
				// If there is a remote wan user using the exact same device as the owner on wan,
				// And the remote users bytes are below streaming traffic while the owners is above
				// Assume that plex has incorrectly identified the device and fix the mapping
				if (remoteUserSample && remoteUserSample.bytes < 27212970 && ownerWanSample.bytes > 27212970) {
					// Change the accountId of the sample to the remote user's id
					ownerWanSample.accountId = remoteUserSample.accountId;
				}
			}
			return ownerWanSample;
		});
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
