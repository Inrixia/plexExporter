import { Sessions } from "./Sessions.js";
import { Session } from "./Session.js";

type SessionSubCache = { [clientIdenfitier: string]: { [accountIdentifier: string]: Session[] } };
type Cache = { lan: SessionSubCache; wan: SessionSubCache };
export class SessionCache {
	private cache: Cache = { lan: {}, wan: {} };

	public setCache(sessions: Sessions["MediaContainer"]) {
		if (sessions.Metadata === undefined) return;
		for (const session of sessions.Metadata) {
			if (!Session.IsValidType(session.type)) continue;

			this.cache[session.Session.location][session.Player.machineIdentifier] ??= {};
			this.cache[session.Session.location][session.Player.machineIdentifier][session.User.id] ??= [];
			this.cache[session.Session.location][session.Player.machineIdentifier][session.User.id].push(new Session(session));
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
