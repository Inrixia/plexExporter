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

		const sessionCache: SessionCache = new SessionCache(Sessions);

		const sessions = Bandwidth.StatisticsBandwidth.map((stat) => new DeviceSample(stat, accountCache, deviceCache, sessionCache)).filter(
			(sample) => sample.isLatest
		);

		//== Fix bad accounts
		// Build a hash of all remote user samples
		const remoteUserSamples: Record<`${number}-${number}`, DeviceSample> = {};
		for (const sample of sessions) {
			// Sample is wan and not the owner
			if (!sample.lan && !sample.isOwner) {
				remoteUserSamples[`${sample.deviceId}-${sample.at}`] = sample;
			}
		}

		for (const sample of sessions) {
			// Sample is wan and the owner
			if (!sample.lan && sample.isOwner) {
				const remoteUserSample = remoteUserSamples[`${sample.deviceId}-${sample.at}`];
				// If there is a remote wan user using the exact same device as the owner on wan,
				// And the remote users bytes are below streaming traffic while the owners is above
				// Assume that plex has incorrectly identified the device and fix the mapping
				if (remoteUserSample && remoteUserSample.bytes < 27212970 && sample.bytes > 27212970) {
					// Change the accountId of the sample to the remote user's id
					sample.setAccountId(remoteUserSample.accountId);
				}
			}
		}
		//==

		// Filter only new samples
		return sessions.filter((sample) => sample.notSent);
	}
}
