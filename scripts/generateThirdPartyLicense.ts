import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

interface DependencyNode {
  version?: string
  path?: string
  dependencies?: Record<string, DependencyNode>
  optionalDependencies?: Record<string, DependencyNode>
}

interface PackageMetadata {
  name?: string
  version?: string
  license?: string
  licenses?: Array<{ type?: string }> | string
  author?: string | { name?: string }
  repository?: string | { url?: string }
}

interface NoticePackage {
  id: string
  license: string
  author: string
  repository: string
  licenseText: string
}

const repoRoot = path.resolve(__dirname, '..')
const desktopRoot = path.join(repoRoot, 'packages', 'desktop')
const buildRoot = path.join(desktopRoot, 'build')
const applicationLicensePath = path.join(repoRoot, 'LICENSE')
const bundledApplicationLicensePath = path.join(buildRoot, 'LICENSE.txt')
const noticesPath = path.join(buildRoot, 'THIRD-PARTY-LICENSES.txt')
const licenseFilename = /^(?:licen[cs]e|copying|notice)(?:[._-].*)?$/i

const normalizeText = (text: string): string =>
  text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim()

const readPackageMetadata = (packagePath: string): PackageMetadata =>
  JSON.parse(fs.readFileSync(path.join(packagePath, 'package.json'), 'utf8')) as PackageMetadata

const normalizeLicense = (metadata: PackageMetadata): string => {
  if (typeof metadata.license === 'string' && metadata.license.trim()) {
    return metadata.license.trim()
  }
  if (typeof metadata.licenses === 'string' && metadata.licenses.trim()) {
    return metadata.licenses.trim()
  }
  if (Array.isArray(metadata.licenses)) {
    const values = metadata.licenses.flatMap((entry) =>
      typeof entry.type === 'string' && entry.type.trim() ? [entry.type.trim()] : []
    )
    if (values.length) return values.join(' OR ')
  }
  return 'UNKNOWN'
}

const authorName = (metadata: PackageMetadata, packageName: string): string => {
  if (typeof metadata.author === 'string' && metadata.author.trim()) return metadata.author.trim()
  if (metadata.author && typeof metadata.author.name === 'string' && metadata.author.name.trim()) {
    return metadata.author.name.trim()
  }
  return `${packageName} contributors`
}

const repositoryUrl = (metadata: PackageMetadata): string => {
  if (typeof metadata.repository === 'string') return metadata.repository
  return metadata.repository?.url ?? ''
}

const readLicenseFiles = (packagePath: string): string => {
  const files = fs
    .readdirSync(packagePath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && licenseFilename.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b))

  return files
    .map((filename) => {
      const text = normalizeText(fs.readFileSync(path.join(packagePath, filename), 'utf8'))
      return files.length > 1 ? `--- ${filename} ---\n\n${text}` : text
    })
    .filter(Boolean)
    .join('\n\n')
}

const mitLicense = (holder: string): string => `MIT License

Copyright (c) ${holder}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`

const iscLicense = (holder: string): string => `ISC License

Copyright (c) ${holder}

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.`

const bsd3License = (holder: string): string => `BSD 3-Clause License

Copyright (c) ${holder}
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice,
   this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.
3. Neither the name of the copyright holder nor the names of its contributors
   may be used to endorse or promote products derived from this software
   without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
POSSIBILITY OF SUCH DAMAGE.`

const fallbackLicenseText = (license: string, holder: string): string => {
  if (/\bMIT\b/.test(license)) return mitLicense(holder)
  if (/\bISC\b/.test(license)) return iscLicense(holder)
  if (/\bBSD-3-Clause\b/.test(license)) return bsd3License(holder)
  throw new Error(`No license text was shipped and no safe fallback exists for ${license}`)
}

const collectDependencyNodes = (): Map<string, DependencyNode> => {
  const output = execFileSync(
    'pnpm',
    ['--filter', 'proplan', 'list', '--prod', '--depth', 'Infinity', '--json'],
    {
      cwd: repoRoot,
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
      // pnpm is exposed as pnpm.cmd on Windows and needs cmd.exe to launch.
      shell: process.platform === 'win32'
    }
  )
  const roots = JSON.parse(output) as DependencyNode[]
  const dependencies = new Map<string, DependencyNode>()

  const visit = (node: DependencyNode): void => {
    for (const field of ['dependencies', 'optionalDependencies'] as const) {
      for (const [name, dependency] of Object.entries(node[field] ?? {})) {
        const version = dependency.version ?? 'unknown'
        const id = `${name}@${version}`
        const installed =
          dependency.path && fs.existsSync(path.join(dependency.path, 'package.json'))
        if (!dependencies.has(id) && (installed || name.startsWith('@vscode/ripgrep-'))) {
          dependencies.set(id, dependency)
        }
        visit(dependency)
      }
    }
  }

  roots.forEach(visit)
  return dependencies
}

const buildNotices = (): NoticePackage[] => {
  const applicationLicense = normalizeText(fs.readFileSync(applicationLicensePath, 'utf8'))
  const dependencies = collectDependencyNodes()
  const ripgrepLicense = readLicenseFiles(
    path.join(desktopRoot, 'node_modules', '@vscode', 'ripgrep')
  )

  return [...dependencies.entries()]
    .map(([id, dependency]): NoticePackage => {
      if (!dependency.path) throw new Error(`Dependency ${id} has no installed path`)
      const packageInstalled = fs.existsSync(path.join(dependency.path, 'package.json'))
      const fallbackName = id.slice(0, id.lastIndexOf('@'))
      const metadata = packageInstalled
        ? readPackageMetadata(dependency.path)
        : {
          name: fallbackName,
          version: dependency.version,
          license: 'MIT',
          author: 'Microsoft Corporation',
          repository: 'https://github.com/microsoft/ripgrep-prebuilt'
        }
      const name = metadata.name ?? id.slice(0, id.lastIndexOf('@'))
      const version = metadata.version ?? dependency.version ?? 'unknown'
      const license = name.startsWith('@vscode/ripgrep-') ? 'MIT' : normalizeLicense(metadata)
      const author = authorName(metadata, name)
      let licenseText = packageInstalled ? readLicenseFiles(dependency.path) : ''

      if (!licenseText && (name === '@muyajs/core' || name === '@marktext/muyajs')) {
        licenseText = applicationLicense
      } else if (!licenseText && name.startsWith('@vscode/ripgrep-')) {
        licenseText = ripgrepLicense
      } else if (!licenseText) {
        licenseText = fallbackLicenseText(license, author)
      }

      if (!licenseText.trim() || /\bundefined\b/.test(licenseText)) {
        throw new Error(`Invalid license text for ${id}`)
      }

      return {
        id: `${name}@${version}`,
        license,
        author,
        repository: repositoryUrl(metadata),
        licenseText
      }
    })
    .sort((a, b) => a.id.localeCompare(b.id))
}

const renderNotices = (packages: NoticePackage[]): string => {
  const summary = packages.map((entry, index) => `${index + 1}. ${entry.id} (${entry.license})`)
  const details = packages.map((entry) => {
    const metadata = [
      `Package: ${entry.id}`,
      `License: ${entry.license}`,
      `Author: ${entry.author}`,
      entry.repository ? `Repository: ${entry.repository}` : ''
    ]
      .filter(Boolean)
      .join('\n')
    return `${'='.repeat(78)}\n${metadata}\n${'-'.repeat(78)}\n${entry.licenseText}`
  })

  return `THIRD-PARTY SOFTWARE NOTICES
${'='.repeat(78)}

Proplan distributions may include the third-party software listed below,
depending on the target platform. This document is generated from the complete
cross-platform pnpm production dependency graph. The applicable license notice
for every listed package follows the summary.

Package count: ${packages.length}

SUMMARY
${'-'.repeat(78)}
${summary.join('\n')}

LICENSE TEXTS AND NOTICES
${details.join('\n\n')}
`
}

const writeOrCheck = (filePath: string, content: string, check: boolean): void => {
  const normalized = content.endsWith('\n') ? content : `${content}\n`
  if (check) {
    const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : ''
    if (existing !== normalized) {
      throw new Error(`${path.relative(repoRoot, filePath)} is missing or stale; run pnpm gen-third-party`)
    }
    return
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, normalized)
}

export const generateThirdPartyNotices = (check = false): number => {
  const applicationLicense = normalizeText(fs.readFileSync(applicationLicensePath, 'utf8'))
  const packages = buildNotices()
  writeOrCheck(bundledApplicationLicensePath, applicationLicense, check)
  writeOrCheck(noticesPath, renderNotices(packages), check)
  return packages.length
}

if (require.main === module) {
  const check = process.argv.includes('--check')
  const count = generateThirdPartyNotices(check)
  console.log(`${check ? 'Validated' : 'Generated'} licenses for ${count} production packages.`)
}
