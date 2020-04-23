const db = require('diskdb')
const fs = require('fs')
const path = require('path')
const express = require('express')
const bodyParser = require('body-parser')

const api = require('./src/api')
const video = require('./src/video')
const HDHR = require('./src/hdhr')

const xmltv = require('./src/xmltv')
const Plex = require('./src/plex')

const helperFuncs = require('./src/helperFuncs')

for (let i = 0, l = process.argv.length; i < l; i++) {
    if ((process.argv[i] === "-p" || process.argv[i] === "--port") && i + 1 !== l)
        process.env.PORT = process.argv[i + 1]
    if ((process.argv[i] === "-h" || process.argv[i] === "--host") && i + 1 !== l)
        process.env.HOST = process.argv[i + 1]
    if ((process.argv[i] === "-d" || process.argv[i] === "--database") && i + 1 !== l)
        process.env.DATABASE = process.argv[i + 1]
    if ((process.argv[i] === "-x" || process.argv[i] === "--xmltv") && i + 1 !== l)
        process.env.XMLTV = process.argv[i + 1]
}

process.env.DATABASE = process.env.DATABASE || './.pseudotv'
process.env.XMLTV = process.env.XMLTV || './.pseudotv/xmltv.xml'
process.env.PORT = process.env.PORT || 8000
process.env.HOST = process.env.HOST || "127.0.0.1"

if (!fs.existsSync(process.env.DATABASE))
    fs.mkdirSync(process.env.DATABASE)

db.connect(process.env.DATABASE, ['channels', 'plex-servers', 'ffmpeg-settings', 'xmltv-settings', 'hdhr-settings'])

initDB(db)

let xmltvInterval = {
    interval: null,
    lastRefresh: null,
    updateXML: () => {
        let channels = db['channels'].find()
        channels.sort((a, b) => { return a.number < b.number ? -1 : 1 })
        let xmltvSettings = db['xmltv-settings'].find()[0]
        xmltv.WriteXMLTV(channels, xmltvSettings).then(() => {    // Update XML
            xmltvInterval.lastRefresh = new Date()
            console.log('XMLTV Updated at ', xmltvInterval.lastRefresh.toLocaleString())
            let plexServers = db['plex-servers'].find()
            for (let i = 0, l = plexServers.length; i < l; i++) {       // Foreach plex server
                let ips = helperFuncs.getIPAddresses()
                for (let y = 0, l2 = ips.length; y < l2; y++) {
                    if (ips[y] === plexServers[i].host) {
                        plexServers[i].host = "127.0.0.1" // If the plex servers IP is the same as PseudoTV, just use the loopback cause for some reason PUT and POST requests will fail.
                        break
                    }
                }
                var plex = new Plex(plexServers[i])
                plex.GetDVRS().then((dvrs) => {                         // Refresh guide and channel mappings
                    if (plexServers[i].arGuide)
                        plex.RefreshGuide(dvrs).then(() => { }, (err) => { console.error(err) })
                    if (plexServers[i].arChannels)
                        plex.RefreshChannels(channels, dvrs).then(() => { }, (err) => { console.error(err) })
                })
            }
        }, (err) => {
            console.error("Failed to write the xmltv.xml file. Check your output directory via the web UI and verify file permissions.")
        })
    },
    startInterval: () => {
        let xmltvSettings = db['xmltv-settings'].find()[0]
        if (xmltvSettings.refresh !== 0) {
            xmltvInterval.interval = setInterval(() => {
                xmltvInterval.updateXML()
            }, xmltvSettings.refresh * 60 * 60 * 1000)
        }
    },
    restartInterval: () => {
        if (xmltvInterval.interval !== null)
            clearInterval(xmltvInterval.interval)
        xmltvInterval.startInterval()
    }
}

xmltvInterval.updateXML()

let hdhr = HDHR(db)
let app = express()
app.use(bodyParser.json())
app.use(express.static(__dirname + '/web/public'))
app.use(api.router(db, xmltvInterval))
app.use(video.router(db))
app.use(hdhr.router)
app.listen(process.env.PORT, () => {
    console.log(`HTTP server running on port: http://${process.env.HOST}:${process.env.PORT}`)
    let hdhrSettings = db['hdhr-settings'].find()[0]
    if (hdhrSettings.autoDiscovery === true)
        hdhr.ssdp.start()
})

function initDB(db) {
    let ffmpegSettings = db['ffmpeg-settings'].find()
    if (ffmpegSettings.length === 0) {
        db['ffmpeg-settings'].save({
            ffmpegPath: "/usr/bin/ffmpeg",
            offset: 0,
            threads: '4',
            videoEncoder: 'mpeg2video',
            videoResolution: '1280x720',
            videoFrameRate: '30',
            videoBitrate: '10000k',
            audioBitrate: '192k',
            audioChannels: '2',
            audioRate: '48000',
            bufSize: '1000k',
            audioEncoder: 'ac3'
        })
    }
    let xmltvSettings = db['xmltv-settings'].find()
    if (xmltvSettings.length === 0) {
        db['xmltv-settings'].save({
            cache: 12,
            refresh: 4,
            file: process.env.XMLTV
        })
    }
    let hdhrSettings = db['hdhr-settings'].find()
    if (hdhrSettings.length === 0) {
        db['hdhr-settings'].save({
            tunerCount: 1,
            autoDiscovery: true
        })
    }
}