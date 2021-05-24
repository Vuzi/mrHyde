
export interface GenerationError {
  path: string
  message: string
}

export function GenerationError(path: string, message: string) {
  return {
    path, message
  }
}

export function isGenerationError(err: GenerationError | any): err is GenerationError {
  return (err as GenerationError).path !== undefined
}

export function isError(err: Error | any): err is Error {
  return (err as Error).message !== undefined
}
