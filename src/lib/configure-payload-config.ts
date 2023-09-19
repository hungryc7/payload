import fse from 'fs-extra'
import path from 'path'

import type { DbDetails } from '../types'
import { warning } from '../utils/log'
import { bundlerPackages, dbPackages } from './packages'

/** Update payload config with necessary imports and adapters */
export async function configurePayloadConfig(args: {
  projectDir: string
  dbDetails: DbDetails | undefined
}): Promise<void> {
  if (!args.dbDetails) {
    return
  }

  // Update package.json
  const packageJsonPath = path.resolve(args.projectDir, 'package.json')
  try {
    const packageObj = await fse.readJson(packageJsonPath)

    const dbPackage = dbPackages[args.dbDetails.type]
    const bundlerPackage = bundlerPackages['webpack']

    packageObj.dependencies[dbPackage.packageName] = 'latest'
    packageObj.dependencies[bundlerPackage.packageName] = 'latest'

    await fse.writeJson(packageJsonPath, packageObj, { spaces: 2 })
  } catch (err: unknown) {
    warning('Unable to update name in package.json')
  }

  const payloadConfigPath = path.resolve(args.projectDir, 'src/payload.config.ts')
  try {
    const configContent = fse.readFileSync(payloadConfigPath, 'utf-8')
    const configLines = configContent.split('\n')

    const dbReplacement = dbPackages[args.dbDetails.type]
    const bundlerReplacement = bundlerPackages['webpack']

    let dbConfigStartLineIndex: number | undefined
    let dbConfigEndLineIndex: number | undefined

    configLines.forEach((l, i) => {
      if (l.includes('// database-adapter-import')) {
        configLines[i] = dbReplacement.importReplacement
      }
      if (l.includes('// bundler-import')) {
        configLines[i] = bundlerReplacement.importReplacement
      }

      if (l.includes('// bundler-config')) {
        configLines[i] = bundlerReplacement.configReplacement
      }

      if (l.includes('// database-adapter-config-start')) {
        dbConfigStartLineIndex = i
      }
      if (l.includes('// database-adapter-config-end')) {
        dbConfigEndLineIndex = i
      }
    })

    if (!dbConfigStartLineIndex || !dbConfigEndLineIndex) {
      warning('Unable to update payload.config.ts with database adapter import')
    } else {
      // Replaces lines between `// database-adapter-config-start` and `// database-adapter-config-end`
      configLines.splice(
        dbConfigStartLineIndex,
        dbConfigEndLineIndex - dbConfigStartLineIndex + 1,
        ...dbReplacement.configReplacement,
      )
    }

    fse.writeFileSync(payloadConfigPath, configLines.join('\n'))
  } catch (err: unknown) {
    warning('Unable to update payload.config.ts with plugins')
  }
}
