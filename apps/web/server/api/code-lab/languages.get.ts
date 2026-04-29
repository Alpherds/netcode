import { createError } from 'h3'

type Judge0Language = {
  id: number
  name: string
  is_archived?: boolean
}

type CodeLabLanguage = {
  id: number
  name: string
  slug: 'cpp' | 'java' | 'python'
  editorLanguage: 'cpp' | 'java' | 'python'
  template: string
}

function buildHeaders(
  authHeaderName: string,
  authToken: string
): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  }

  if (authToken.trim()) {
    headers[authHeaderName] = authToken.trim()
  }

  return headers
}

function buildTemplate(slug: 'cpp' | 'java' | 'python') {
  if (slug === 'cpp') {
    return `#include <iostream>
using namespace std;

int main() {
  cout << "Hello from C++" << endl;
  return 0;
}
`
  }

  if (slug === 'java') {
    return `public class Main {
  public static void main(String[] args) {
    System.out.println("Hello from Java");
  }
}
`
  }

  return `print("Hello from Python")
`
}

function mapLanguage(
  item: Judge0Language
): CodeLabLanguage | null {
  const name = String(item.name || '').toLowerCase()

  if (name.includes('c++')) {
    return {
      id: item.id,
      name: item.name,
      slug: 'cpp',
      editorLanguage: 'cpp',
      template: buildTemplate('cpp'),
    }
  }

  if (name.includes('java') && !name.includes('javascript')) {
    return {
      id: item.id,
      name: item.name,
      slug: 'java',
      editorLanguage: 'java',
      template: buildTemplate('java'),
    }
  }

  if (name.includes('python')) {
    return {
      id: item.id,
      name: item.name,
      slug: 'python',
      editorLanguage: 'python',
      template: buildTemplate('python'),
    }
  }

  return null
}

export default defineEventHandler(async () => {
  const config = useRuntimeConfig()

  if (!config.JUDGE0_URL) {
    throw createError({
      statusCode: 500,
      statusMessage: 'JUDGE0_URL is not configured.',
    })
  }

  const headers = buildHeaders(
    config.JUDGE0_AUTH_HEADER,
    config.JUDGE0_AUTH_TOKEN
  )

  try {
    const response = await $fetch<Judge0Language[]>(
      `${config.JUDGE0_URL.replace(/\/$/, '')}/languages`,
      {
        method: 'GET',
        headers,
      }
    )

    const mapped = (response || [])
      .filter((item) => !item.is_archived)
      .map(mapLanguage)
      .filter((item): item is CodeLabLanguage => Boolean(item))

    const uniqueBySlug = new Map<string, CodeLabLanguage>()

    for (const item of mapped) {
      if (!uniqueBySlug.has(item.slug)) {
        uniqueBySlug.set(item.slug, item)
      }
    }

    return Array.from(uniqueBySlug.values())
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage:
        error?.data?.error ||
        error?.message ||
        'Failed to load Judge0 languages.',
    })
  }
})