import got from "got";
import { Account, Bandwidth } from "./Bandwidth.js";
import { Sessions } from "./Sessions.js";
import { DeviceSession as DeviceSample } from "./DeviceSession.js";
import { SessionCache } from "./SessionCache.js";

export type AccountCache = { [accountId: string]: Account["name"] };
export type DeviceCache = {
	[deviceId: string]: {
		name: string;
		platform: string;
		clientIdentifier: string;
	};
};

export class PlexMeta {
	private url: string;
	private token: string;
	private timespan: 1 | 2 | 3 | 4 | 6;

	private sessionCache = new SessionCache();

	constructor({ url, token, timespan }: { url: string; token: string; timespan?: 1 | 2 | 3 | 4 | 6 }) {
		this.url = url;
		this.token = token;
		this.timespan = timespan ?? 6;
	}

	private async getBandwidth() {
		const { MediaContainer } = await got.get<Bandwidth>({
			responseType: "json",
			resolveBodyOnly: true,
			https: { rejectUnauthorized: false },
			method: "GET",
			url: `${this.url}/statistics/bandwidth`,
			searchParams: {
				timespan: this.timespan,
				"X-Plex-Token": this.token,
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
		return MediaContainer;
	}
	private async getSessions() {
		const { MediaContainer } = await got.get<Sessions>({
			responseType: "json",
			resolveBodyOnly: true,
			https: { rejectUnauthorized: false },
			method: "GET",
			url: `${this.url}/status/sessions`,
			searchParams: {
				"X-Plex-Token": this.token,
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
		return MediaContainer;
	}

	public async getSessionSamples() {
		const [Bandwidth, Sessions] = await Promise.all([this.getBandwidth(), this.getSessions()]);

		this.sessionCache.clearCache();
		this.sessionCache.setCache(Sessions);

		const deviceCache: DeviceCache = {};
		for (const device of Bandwidth.Device) {
			deviceCache[device.id] = {
				name: device.name,
				platform: device.platform,
				clientIdentifier: device.clientIdentifier,
			};
		}

		const accountCache: AccountCache = {};
		for (const account of Bandwidth.Account) {
			accountCache[account.id] = account.name;
		}

		const samples = Bandwidth.StatisticsBandwidth.map((stat) => new DeviceSample(stat, accountCache, deviceCache, this.sessionCache)).filter(
			(sample) => sample.isLatest
		);

		//== Fix bad accounts
		for (const owSample of samples.filter((session) => session.isOwner && !session.lan)) {
			// Owners wan bytes are above streaming traffic
			const ownerSampleBytes = owSample.bytes;
			if (ownerSampleBytes > 100000) {
				const owTotalSessionBandwidth = owSample.totalSessionBandwidth;
				let deviceTotalSessionBandwidth = owTotalSessionBandwidth;
				// Remote user bytes is below streaming traffic, has sessions and is also using the same client
				const userSamples = samples.filter(
					(sample) => sample.clientIdentifier === owSample.clientIdentifier && sample.bytes < 100000 && sample.sessions.length > 0
				);

				// Calculate the total session bandwidth for this device
				for (const userSample of userSamples) {
					deviceTotalSessionBandwidth += userSample.totalSessionBandwidth;
				}
				// Dish out the owners bytes to each user based on their sessions
				for (const userSample of userSamples) {
					if (userSample.at < owSample.at) userSample.at = owSample.at;
					userSample.allocateBytes(ownerSampleBytes, deviceTotalSessionBandwidth);
				}
				owSample.bytes = 0;
				// Dish out the owners share if they also have a session
				if (owTotalSessionBandwidth > 0) owSample.allocateBytes(ownerSampleBytes, deviceTotalSessionBandwidth);
			}
		}
		//==

		// Filter only new samples
		return samples.filter((sample) => sample.notSent);
	}
}
