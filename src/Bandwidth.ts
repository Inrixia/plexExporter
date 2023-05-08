export interface Bandwidth {
	MediaContainer: MediaContainer;
}

export interface MediaContainer {
	size: number;
	Device: Device[];
	Account: Account[];
	StatisticsBandwidth: StatisticsBandwidth[];
}

export interface Account {
	id: number;
	key: `/accounts/${number}`;
	name: string;
	defaultAudioLanguage: string;
	autoSelectAudio: boolean;
	defaultSubtitleLanguage: string;
	subtitleMode: number;
	thumb: `https://plex.tv/users/${number}/avatar?c=${number}`;
}

export interface Device {
	id: number;
	name: string;
	platform: string;
	clientIdentifier: string;
	createdAt: number;
}

export interface StatisticsBandwidth {
	accountID: number;
	deviceID: number;
	timespan: number;
	at: number;
	lan: boolean;
	bytes: number;
}
