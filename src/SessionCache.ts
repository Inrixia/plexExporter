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
type SessionSubCache = { [id: `${string}-${string}`]: SmolSession[] };
export class SessionCache {
	private cache: { lan: SessionSubCache; wan: SessionSubCache } = { lan: {}, wan: {} };

	constructor(sessions: Sessions["MediaContainer"]) {
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

			const cacheId = `${session.User.id}-${session.Player.machineIdentifier}` as const;

			this.cache[session.Session.location][cacheId] ??= [];
			this.cache[session.Session.location][cacheId].push(newSession);
		}
	}

	public get(lan: boolean, accountId: number, clinetIdentifier: string) {
		return this.cache[lan ? "lan" : "wan"][`${accountId}-${clinetIdentifier}`] ?? [];
	}
}
