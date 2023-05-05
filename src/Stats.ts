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

type AccountCacheEntry = Account["name"];
type DeviceCacheEntry = {
	name: string;
	platform: string;
	clientIdentifier: string;
};

type Stat = [
	labels: {
		// Account info
		accountName: string;
		accountId: string;
		// Device info
		deviceId: string;
		deviceName: string;
		devicePlatform: string;
		clientIdentifier: string;
		// Data info
		lan: string;
	},
	bytes: number
];

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

		const accountCache: { [accountId: string]: AccountCacheEntry } = {};
		for (const account of MediaContainer.Account) {
			accountCache[account.id] = account.name;
		}

		const deviceCache: { [deviceId: string]: DeviceCacheEntry } = {};
		for (const device of MediaContainer.Device) {
			deviceCache[device.id] = {
				name: device.name,
				platform: device.platform,
				clientIdentifier: device.clientIdentifier,
			};
		}
		return MediaContainer.StatisticsBandwidth.map((stat) => ({
			...stat,
			uid: `${stat.deviceID}-${stat.accountID}`,
			make: (bytes?: number): Stat => [
				{
					// Account info
					accountName: accountCache[stat.accountID],
					accountId: stat.accountID.toString(),
					// Device info
					deviceId: stat.deviceID.toString(),
					deviceName: deviceCache[stat.deviceID].name,
					devicePlatform: deviceCache[stat.deviceID].platform,
					clientIdentifier: deviceCache[stat.deviceID].clientIdentifier,
					// Net info
					lan: stat.lan.toString(),
				},
				bytes ?? stat.bytes,
			],
		}));
	};

	const latestSamples = await getMediaContainer(6);

	const maxAts: Record<string, number> = {};
	for (const sample of latestSamples) {
		maxAts[sample.uid] ??= sample.at;
		if (sample.at > maxAts[sample.uid]) maxAts[sample.uid] = sample.at;
	}

	return latestSamples.filter((sample) => {
		if (maxAts[sample.uid] === sample.at && lastSentStatTimetamps[sample.uid] !== sample.at) {
			lastSentStatTimetamps[sample.uid] = sample.at;
			return true;
		}
		return false;
	});
};
