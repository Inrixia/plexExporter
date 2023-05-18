import type { Metadata } from "./Sessions.js";

export enum SessionType {
	Movie = "movie",
	Show = "episode",
}

export enum SessionState {
	Playing = "playing",
	Paused = "paused",
	Buffering = "buffering",
}
export class Session<T extends SessionType = SessionType> {
	public type: T;
	protected meta: Metadata;

	public static IsValidType(sessionType: string): boolean {
		return sessionType === SessionType.Movie || sessionType === SessionType.Show;
	}

	constructor(meta: Metadata) {
		this.meta = meta;
		if (!Session.IsValidType(meta.type)) throw new Error(`Unknown session type: ${meta.type}`);
		this.type = <T>meta.type;
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

	public isShow() {
		return this.type === SessionType.Show;
	}

	public get seriesTitle(): T extends SessionType.Show ? string : undefined {
		return <any>this.meta.grandparentTitle;
	}
	public get seasonNo(): T extends SessionType.Show ? number : undefined {
		return <any>this.meta.parentIndex;
	}
	public get seasonTitle(): T extends SessionType.Show ? string : undefined {
		return <any>this.meta.parentTitle;
	}
	public get episodeNo(): T extends SessionType.Show ? number : undefined {
		return <any>this.meta.index;
	}

	public get bitrate(): number {
		if (this.state === SessionState.Paused) return 0;
		let bitrate = this.meta.Media.reduce((totalBitrate, media) => totalBitrate + media.bitrate, 0);
		if (isNaN(bitrate) && !isNaN(this.meta.Session.bandwidth)) bitrate = this.meta.Session.bandwidth;
		if (isNaN(bitrate)) bitrate = 10000;

		return bitrate;
	}

	public getAllocation(totalBitrate: number, bytes: number): number {
		return this.state !== SessionState.Paused ? (this.bitrate / totalBitrate) * bytes : 0;
	}
}
