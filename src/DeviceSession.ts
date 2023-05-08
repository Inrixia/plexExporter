import type { StatisticsBandwidth } from "./Bandwidth.js";
import type { AccountCache, DeviceCache } from "./Stats.js";
import type { SessionCache } from "./SessionCache.js";
import { Session } from "./Session.js";

type Labels = Partial<Record<typeof DeviceSession["LabelNames"][number], string>>;

export class DeviceSession {
	public static readonly LabelNames = [
		"accountName",
		"accountId",
		"deviceId",
		"deviceName",
		"devicePlatform",
		"clientIdentifier",
		"net",
		"mediaTitle",
		"address",
		"state",
	] as const;

	private static LastSentSamples: Record<string, number> = {};
	private static LatestSamples: Record<string, number> = {};

	public readonly lan: boolean;
	public at: number;
	public bytes: number;

	public readonly deviceId: number;
	public readonly deviceName: string;
	public readonly devicePlatform: string;
	public readonly clientIdentifier: string;

	private originalAccountId?: number;
	public readonly accountId: number;

	private readonly sessionCache: SessionCache;
	private readonly accountCache: AccountCache;

	constructor(stat: StatisticsBandwidth, accountCache: AccountCache, deviceCache: DeviceCache, sessionCache: SessionCache) {
		this.accountId = stat.accountID;
		this.deviceId = stat.deviceID;

		this.lan = stat.lan;
		this.at = stat.at;
		this.bytes = stat.bytes;

		this.deviceName = deviceCache[this.deviceId].name;
		this.devicePlatform = deviceCache[this.deviceId].platform;
		this.clientIdentifier = deviceCache[this.deviceId].clientIdentifier;

		this.sessionCache = sessionCache;
		this.accountCache = accountCache;

		DeviceSession.LatestSamples[this.uid] ??= this.at;
		if (DeviceSession.LatestSamples[this.uid] < this.at) DeviceSession.LatestSamples[this.uid] = this.at;
	}

	public get isOwner() {
		return this.accountId === 1;
	}

	public get notSent() {
		if (DeviceSession.LastSentSamples[this.uid] === undefined) return true;
		if (DeviceSession.LastSentSamples[this.uid] >= this.at) return false;
		return true;
	}
	public get isLatest() {
		return DeviceSession.LatestSamples[this.uid] === this.at;
	}

	public get sessions() {
		return this.sessionCache.getSessions(this.lan, this.accountId, this.clientIdentifier);
	}

	public get totalSessionBitrate() {
		return this.sessions.reduce((total, session) => total + session.bitrate, 0);
	}

	public allocateBytes(totalBitrate: number, bytes: number) {
		for (const session of this.sessions) {
			this.bytes += session.getAllocation(totalBitrate, bytes);
		}
	}

	public getSamples() {
		DeviceSession.LastSentSamples[this.uid] = this.at;

		const samples: { labels: Labels; bytes: number }[] = [];

		const sessions = this.sessions;

		if (sessions.length !== 0) {
			// Distribute bandwidth across all sessions
			const totalSessionBandwidth = this.totalSessionBitrate;
			for (const session of sessions) {
				const estimatedBytes = session.getAllocation(totalSessionBandwidth, this.bytes);
				samples.push({ labels: this.getLabels(session), bytes: estimatedBytes });
			}
		} else samples.push({ labels: this.getLabels(), bytes: this.bytes });

		return samples;
	}

	private getLabels(session?: Session): Labels {
		const accountName = session?.userTitle ?? this.accountCache[this.accountId];
		const accountId = session?.userId ?? this.accountId.toString();

		const labels: Labels = {
			// Account info
			accountName,
			accountId,
			// Device info
			deviceName: this.deviceName,
			devicePlatform: this.devicePlatform,
			clientIdentifier: this.clientIdentifier,
			// Net info
			net: this.lan ? "lan" : "wan",
		};

		if (session !== undefined) {
			let mediaTitle = `${session.title} (${session.year})`;
			if (session.isShow()) mediaTitle = `${session.seriesTitle} - S${session.seasonNo}E${session.episodeNo} - ${session.title}`;

			labels.mediaTitle = mediaTitle;
			labels.address = session.address;
			labels.state = session.state;
		}

		return labels;
	}

	public get uid() {
		return `${this.accountId}:${this.deviceId}`;
	}
}
