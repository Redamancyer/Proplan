import Preference from '../preferences'
import type { AppEnvironment } from './env'
import type AppPaths from './paths'

class Accessor {
  public readonly env: AppEnvironment
  public readonly paths: AppPaths
  public readonly preferences: Preference

  constructor(appEnvironment: AppEnvironment) {
    this.env = appEnvironment
    this.paths = appEnvironment.paths
    this.preferences = new Preference(this.paths)
  }
}

export default Accessor
