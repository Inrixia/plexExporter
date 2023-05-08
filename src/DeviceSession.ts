import type { StatisticsBandwidth } from "./Bandwidth.js";
import type { AccountCache, DeviceCache } from "./Stats.js";
import type { SessionCache, SmolSession } from "./SessionCache.js";

type Labels = Partial<Record<typeof DeviceSession["LabelNames"][number], string>>;

export class DeviceSession {
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
		"mediaTitle",
		"address",
		"state",
	] as const;

	private static LastSentSamples: Record<string, number> = {};
	private static LatestSamples: Record<string, number> = {};

	public readonly lan: boolean;
	public readonly at: number;
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

	public get isRemoteUser() {
		return !this.lan && this.accountId !== 1;
	}
	public get isOwner() {
		return this.accountId === 1;
	}

	public setAccountId(accountId: number) {
		this.originalAccountId = this.accountId;
		// @ts-expect-error I wanna overwrite this.
		this.accountId = accountId;
	}

	public get notSent() {
		if (DeviceSession.LastSentSamples[this.uid] === undefined) return true;
		if (DeviceSession.LastSentSamples[this.uid] >= this.at) return false;
		return true;
	}
	public get isLatest() {
		return DeviceSession.LatestSamples[this.uid] === this.at;
	}

	public getSamples() {
		DeviceSession.LastSentSamples[this.uid] = this.at;

		const samples: { labels: Labels; bytes: number }[] = [];

		const sessions = this.sessionCache.get(this.lan, this.accountId, this.clientIdentifier);

		if (sessions.length !== 0) {
			// Distribute bandwidth across all sessions
			const totalSessionBandwidth = sessions.reduce((total, session) => {
				if (session.Player.state !== "paused") return total + session.Session.bandwidth;
				return total;
			}, 0);
			for (const session of sessions) {
				const estimatedBytes = session.Player.state !== "paused" ? (session.Session.bandwidth / totalSessionBandwidth) * this.bytes : 0;
				samples.push({ labels: this.getLabels(session), bytes: estimatedBytes });
			}
		} else samples.push({ labels: this.getLabels(), bytes: this.bytes });

		return samples;
	}

	private getLabels(session?: SmolSession): Labels {
		const accountName = session?.User.title ?? this.accountCache[this.accountId];
		const accountId = session?.User.id ?? this.accountId.toString();

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
			if (session.type === "episode") mediaTitle = `${session.seriesTitle} - S${session.seasonNo}E${session.episodeNo} - ${session.title}`;

			labels.mediaTitle = mediaTitle;
			labels.address = session.Player.address;
			labels.state = session.Player.state;
		}

		if (this.originalAccountId !== undefined) {
			labels.originalAccountId = this.originalAccountId.toString();
			labels.originalAccountName = this.accountCache[this.originalAccountId];
		}

		return labels;
	}

	public get uid() {
		return `${this.accountId}:${this.deviceId}`;
	}
}