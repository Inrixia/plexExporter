import got from "got";
import { parseStringPromise } from "xml2js";

type Account = {
	id: string;
	key: string;
	name: string;
	autoSelectAudio: string;
	defaultSubtitleLanguage: string;
	subtitleMode: string;
	thumb: string;
};
type AccountCacheEntry = Account["name"];
type Device = {
	id: string;
	name: string;
	platform: string;
	clientIdentifier: string;
	createdAt: string;
};
type DeviceCacheEntry = {
	name: string;
	platform: string;
	clientIdentifier: string;
};
type JsonResponse = {
	MediaContainer?: {
		Device: {
			$: Device;
		}[];
		Account: {
			$: Account;
		}[];
		StatisticsBandwidth: {
			$: {
				accountID: string;
				deviceID: string;
				timespan: string;
				at: string;
				lan: string;
				bytes: string;
			};
		}[];
	};
};

type Stat = {
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
	};
	bytes: number;
};

const lastSentStatTimetamps: { [deviceId: string]: string } = {};
export const getStats = async (token: string, url: string) => {
	const result = await got.get({
		resolveBodyOnly: true,
		https: { rejectUnauthorized: false },
		method: "GET",
		url: `${url}/statistics/bandwidth`,
		searchParams: {
			timespan: 6,
			"X-Plex-Token": token,
			"X-Plex-Device-Name": "PrometheusExporter",
		},
	});
	const { MediaContainer }: JsonResponse = await parseStringPromise(result);
	if (MediaContainer === undefined) return undefined;

	const accountCache: { [accountId: string]: AccountCacheEntry } = {};
	for (const account of MediaContainer.Account) {
		accountCache[account.$.id] = account.$.name;
	}

	const deviceCache: { [deviceId: string]: DeviceCacheEntry } = {};
	for (const device of MediaContainer.Device) {
		deviceCache[device.$.id] = {
			name: device.$.name,
			platform: device.$.platform,
			clientIdentifier: device.$.clientIdentifier,
		};
	}

	const latestStatTimestamps: { [deviceId: string]: string } = {};
	MediaContainer.StatisticsBandwidth.forEach(({ $: { deviceID, at } }) => {
		if (!latestStatTimestamps[deviceID] || latestStatTimestamps[deviceID] < at) latestStatTimestamps[deviceID] = at;
	});

	return MediaContainer.StatisticsBandwidth.filter(
		({ $: { deviceID, at } }) => at === latestStatTimestamps[deviceID] && at > (lastSentStatTimetamps[deviceID] ?? 0)
	).map(({ $: { deviceID, accountID, lan, bytes, at } }) => {
		lastSentStatTimetamps[deviceID] = at;
		return {
			labels: {
				// Account info
				accountName: accountCache[accountID],
				accountId: accountID,
				// Device info
				deviceId: deviceID,
				deviceName: deviceCache[deviceID].name,
				devicePlatform: deviceCache[deviceID].platform,
				clientIdentifier: deviceCache[deviceID].clientIdentifier,
				// Data info
				lan,
			},
			bytes: Number.parseInt(bytes),
		};
	});
};
