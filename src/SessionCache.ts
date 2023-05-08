import { Player, Sessions, User, Session } from "./Sessions.js";

interface BaseSession {
	title: string;
	year: number;
	User: User;
	Player: Player;
	Session: Session;
}
interface SessionEpisode extends BaseSession {
	type: "episode";
	seriesTitle: string;
	seasonNo: number;
	seasonTitle: string;
	episodeNo: number;
}
interface SessionMovie extends BaseSession {
	type: "movie";
}
export type SmolSession = SessionEpisode | SessionMovie;
type SessionSubCache = { [clientIdenfitier: string]: { [accountIdentifier: string]: SmolSession[] } };
type Cache = { lan: SessionSubCache; wan: SessionSubCache };
export class SessionCache {
	private cache: Cache = { lan: {}, wan: {} };

	public setCache(sessions: Sessions["MediaContainer"]) {
		if (sessions.Metadata === undefined) return;
		for (const session of sessions.Metadata) {
			let newSession: SmolSession | undefined;
			if (session.type === "movie") {
				newSession = {
					type: session.type,
					title: session.title,
					year: session.year!,
					User: session.User,
					Player: session.Player,
					Session: session.Session,
				};
			}
			if (session.type === "episode") {
				newSession = {
					type: session.type,
					year: session.year!,
					seriesTitle: session.grandparentTitle!,
					seasonNo: session.parentIndex!,
					seasonTitle: session.parentTitle!,
					episodeNo: session.index!,
					title: session.title,
					User: session.User,
					Player: session.Player,
					Session: session.Session,
				};
			}
			if (newSession === undefined) continue;

			this.cache[session.Session.location][session.Player.machineIdentifier] ??= {};
			this.cache[session.Session.location][session.Player.machineIdentifier][session.User.id] ??= [];
			this.cache[session.Session.location][session.Player.machineIdentifier][session.User.id].push(newSession);
		}
	}

	public clearCache() {
		this.cache = { lan: {}, wan: {} };
	}

	public getSessions(lan: boolean, accountId: number, clientIdentifier: string) {
		return this.cache[lan ? "lan" : "wan"][clientIdentifier]?.[accountId] ?? [];
	}

	public getDeviceSessions(lan: boolean, clientIdentifier: string) {
		return Object.values(this.cache[lan ? "lan" : "wan"][clientIdentifier]).flatMap((s) => s) ?? [];
	}
}
