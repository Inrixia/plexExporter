import { Gauge, register } from "prom-client";
import { createServer } from "http";
import { Sample, getStats } from "./Stats.js";

if (process.env.PLEX_TOKEN === undefined) throw new Error("PLEX_TOKEN env var net set!");
if (process.env.PLEX_SERVER === undefined) throw new Error("PLEX_SERVER env var net set! Example: https://plex.ip.address:port");
const plexServer = process.env.PLEX_SERVER;
const listenPort = process.env.LISTEN_PORT ?? 3000;
const plexToken = process.env.PLEX_TOKEN;

console.log(`Creating metric plex_device_bytes_used...`);
// Create a Gauge metric for the bytes used
new Gauge({
	name: "plex_device_bytes_used",
	help: "Bytes used by a plex device",
	labelNames: Sample.LabelNames,
	async collect() {
		this.reset();
		const samples = await getStats(plexToken, plexServer).catch((err) => console.log(`An error occurred: ${err}`));
		if (samples !== undefined)
			for (const sample of samples) {
				this.set(sample.labels, sample.bytes);
			}
	},
});

console.log(`Creating http server...`);
createServer(async (req, res) => {
	if (req.url === "/metrics") {
		// Fetch and process the stats when the /metrics endpoint is called
		res.setHeader("Content-Type", register.contentType);
		res.end(await register.metrics());
	} else {
		res.statusCode = 404;
		res.end("Not found");
	}
}).listen(listenPort, () => console.log(`Server listening on port ${listenPort}`));
