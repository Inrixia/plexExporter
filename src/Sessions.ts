export interface Sessions {
	MediaContainer: MediaContainer;
}

export interface MediaContainer {
	size: number;
	Metadata: Metadata[];
}

export interface Metadata {
	addedAt: number;
	art: string;
	duration: number;
	grandparentArt?: string;
	grandparentGuid?: string;
	grandparentKey?: string;
	grandparentRatingKey?: string;
	grandparentThumb?: string;
	grandparentTitle?: string;
	guid: string;
	index?: number;
	key: string;
	librarySectionID: string;
	librarySectionKey: string;
	librarySectionTitle: string;
	musicAnalysisVersion?: string;
	originalTitle?: string;
	parentGuid?: string;
	parentIndex?: number;
	parentKey?: string;
	parentRatingKey?: string;
	parentStudio?: string;
	parentThumb?: string;
	parentTitle?: string;
	parentYear?: number;
	ratingCount?: number;
	ratingKey: string;
	sessionKey: string;
	thumb: string;
	title: string;
	type: "episode" | "movie";
	updatedAt: number;
	viewOffset: number;
	Media: Media[];
	User: User;
	Player: Player;
	Session: Session;
	audienceRating?: number;
	audienceRatingImage?: string;
	chapterSource?: string;
	contentRating?: string;
	grandparentTheme?: string;
	originallyAvailableAt?: Date;
	summary?: string;
	year?: number;
	Director?: Country[];
	Writer?: Country[];
	Rating?: Rating[];
	Role?: Role[];
	TranscodeSession?: TranscodeSession;
	lastViewedAt?: number;
	viewCount?: number;
	primaryExtraKey?: string;
	rating?: number;
	ratingImage?: string;
	studio?: string;
	tagline?: string;
	Genre?: Country[];
	Producer?: Country[];
	Country?: Country[];
}

export interface Country {
	count?: string;
	filter: string;
	id: string;
	tag: string;
}

export interface Media {
	audioChannels: number;
	audioCodec: string;
	bitrate?: number;
	container: string;
	duration: number;
	id: string;
	selected?: boolean;
	Part?: Part[];
	audioProfile?: string;
	videoProfile?: string;
	height?: number;
	optimizedForStreaming?: boolean;
	protocol?: string;
	videoCodec?: string;
	videoFrameRate?: string;
	videoResolution?: string;
	width?: number;
	aspectRatio?: string;
}

export interface Part {
	container: string;
	duration: number;
	file?: string;
	id: string;
	key?: string;
	size?: number;
	decision?: string;
	selected?: boolean;
	Stream?: Stream[];
	audioProfile?: string;
	indexes?: string;
	videoProfile?: string;
	bitrate?: number;
	height?: number;
	optimizedForStreaming?: boolean;
	protocol?: string;
	width?: number;
	hasThumbnail?: string;
}

export interface Stream {
	albumGain?: string;
	albumPeak?: string;
	albumRange?: string;
	audioChannelLayout?: string;
	bitDepth?: number;
	bitrate?: number;
	channels?: number;
	codec: string;
	displayTitle: string;
	extendedDisplayTitle: string;
	gain?: string;
	id: string;
	index?: number;
	loudness?: string;
	lra?: string;
	peak?: string;
	samplingRate?: number;
	selected?: boolean;
	streamType: number;
	location?: string;
	chromaLocation?: string;
	chromaSubsampling?: string;
	codedHeight?: number;
	codedWidth?: number;
	frameRate?: number;
	hasScalingMatrix?: boolean;
	height?: number;
	language?: string;
	languageCode?: string;
	languageTag?: string;
	level?: number;
	profile?: string;
	refFrames?: number;
	scanType?: string;
	width?: number;
	decision?: string;
	bitrateMode?: string;
	default?: boolean;
	title?: string;
	format?: string;
	key?: string;
	colorPrimaries?: string;
	colorRange?: string;
	colorSpace?: string;
	colorTrc?: string;
}

export interface Player {
	address: string;
	device: string;
	machineIdentifier: string;
	model: string;
	platform: string;
	platformVersion: string;
	product: string;
	profile: string;
	remotePublicAddress: string;
	state: string;
	title: string;
	version: string;
	local: boolean;
	relayed: boolean;
	secure: boolean;
	userID: number;
}

export interface Rating {
	image: string;
	type: Type;
	value: string;
	count?: string;
}

export enum Type {
	Audience = "audience",
	Critic = "critic",
}

export interface Role {
	filter: string;
	id: string;
	role?: string;
	tag: string;
	tagKey: string;
	thumb?: string;
	count?: string;
}

export interface Session {
	id: string;
	bandwidth: number;
	location: "lan" | "wan";
}

export interface TranscodeSession {
	key: string;
	throttled: boolean;
	complete: boolean;
	progress: number;
	size: number;
	speed: number;
	error: boolean;
	duration: number;
	remaining?: number;
	context: string;
	sourceVideoCodec: string;
	sourceAudioCodec: string;
	videoDecision: string;
	audioDecision: string;
	protocol: string;
	container: string;
	videoCodec: string;
	audioCodec: string;
	audioChannels: number;
	width?: number;
	height?: number;
	transcodeHwRequested: boolean;
	transcodeHwFullPipeline: boolean;
	timeStamp: number;
	maxOffsetAvailable?: number;
	minOffsetAvailable?: number;
	transcodeHwDecoding?: string;
	transcodeHwEncoding?: string;
	transcodeHwDecodingTitle?: string;
	transcodeHwEncodingTitle?: string;
}

export interface User {
	id: string;
	thumb: string;
	title: string;
}
