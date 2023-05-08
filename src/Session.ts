import type { Metadata } from "./Sessions.js";

export enum SessionType {
	Movie,
	Show,
}

export enum SessionState {
	Playing = "playing",
	Paused = "paused",
	Buffering = "buffering",
}

export class Session {
	public type: SessionType;
	protected meta: Metadata;

	public static IsValidType(sessionType: string): boolean {
		return sessionType === "movie" || sessionType === "show";
	}

	constructor(meta: Metadata) {
		this.meta = meta;
		if (meta.type === "episode") this.type = SessionType.Show;
		else if (meta.type === "movie") this.type = SessionType.Movie;
		else throw new Error(`Unknown session type: ${meta.type}`);
	}

	public get userId(): string {
		return this.meta.User.id;
	}
	public get userTitle(): string {
		return this.meta.User.title;
	}

	public get title(): string {
		return this.meta.title;
	}
	public get year(): number {
		return this.meta.year!;
	}

	public get state(): SessionState {
		return <SessionState>this.meta.Player.state;
	}
	public get address(): string {
		return this.meta.Player.address;
	}

	public isMovie(): this is MovieSession {
		return this.type === SessionType.Movie;
	}
	public isShow(): this is ShowSession {
		return this.type === SessionType.Show;
	}

	public get bitrate(): number {
		if (this.state === SessionState.Paused) return 0;
		let bitrate = this.meta.Media.reduce((totalBitrate, media) => totalBitrate + media.bitrate, 0);
		if (isNaN(bitrate) && !isNaN(this.meta.Session.bandwidth)) bitrate = this.meta.Session.bandwidth;
		else bitrate = 10000;

		return bitrate * (this.state === SessionState.Buffering ? 4 : 1);
	}

	public getAllocation(totalBitrate: number, bytes: number): number {
		return this.state !== SessionState.Paused ? (this.bitrate / totalBitrate) * bytes : 0;
	}
}

export class MovieSession extends Session {
	public type = SessionType.Movie;
}
export class ShowSession extends Session {
	public type = SessionType.Show;

	public get seriesTitle(): string {
		return this.meta.grandparentTitle!;
	}
	public get seasonNo(): number {
		return this.meta.parentIndex!;
	}
	public get seasonTitle(): string {
		return this.meta.parentTitle!;
	}
	public get episodeNo(): number {
		return this.meta.index!;
	}
}
