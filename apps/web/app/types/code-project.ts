export type CodeProjectLanguage = 'cpp' | 'java' | 'python'

export type CodeProjectDto = {
  id: number
  documentId: string
  title: string
  language: CodeProjectLanguage
  sourceCode: string
  stdin: string
  latestStdout: string
  latestStderr: string
  latestCompileOutput: string
  latestMessage: string
  latestStatus: string
  latestTime: string
  latestMemory: number | null
  latestExitCode: number | null
  isSubmitted: boolean
  exerciseKey: string
  createdAt?: string
  updatedAt?: string
}

export type SaveCodeProjectInput = {
  title: string
  language: CodeProjectLanguage
  sourceCode: string
  stdin: string
  latestStdout?: string
  latestStderr?: string
  latestCompileOutput?: string
  latestMessage?: string
  latestStatus?: string
  latestTime?: string
  latestMemory?: number | null
  latestExitCode?: number | null
  isSubmitted?: boolean
  exerciseKey?: string
}