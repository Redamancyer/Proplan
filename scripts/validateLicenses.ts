import { generateThirdPartyNotices } from './generateThirdPartyLicense'

const count = generateThirdPartyNotices(true)
console.log(`Validated bundled license notices for ${count} production packages.`)
