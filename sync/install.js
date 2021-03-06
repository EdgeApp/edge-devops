const fs = require('fs')
const fetch = require('node-fetch')
const parse = require('url-parse')
let config = require('/home/bitz/code/airbitz-sync-server/syncConfig.sample.json')
config.couchAdminPassword = process.argv[2]
config.couchUserPassword = process.argv[3]
config.reposUrl = `https://${process.argv[4]}/repos/`
config.couchSeedServer = process.argv[5]

fs.writeFileSync('/home/bitz/code/airbitz-sync-server/syncConfig.json', JSON.stringify(config))

main()

async function main () {
    if (!config.couchSeedServer) {
        console.log('No seed server. Not setting up replication')
        return
    }
    const uriObj = parse(config.couchSeedServer, {}, true)
    console.log(uriObj)
    const repHost = 'rep_' + uriObj.hostname.split('.')[0]

    const srcUrl = config.couchSeedServer + '/db_repos'
    const dstUrl = `http://admin:${config.couchAdminPassword}@localhost:5984/db_repos`
    const body = {
        _id: repHost,
        source: srcUrl,
        target:  dstUrl,
        create_target:  true,
        continuous: true
    }

    const result = await fetch(
        `http://admin:${config.couchAdminPassword}@localhost:5984/_replicator/${repHost}`, { 
        method: 'PUT',
        body:    JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' }})

    const out = await result.json()
    console.log(out) 
}