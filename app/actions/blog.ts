'use server'

import { createClient } from '@/lib/supabase/server'
import { blogAdminApi, type BlogPostDto, type BlogPostWriteDto } from '@/lib/api/client'
import { revalidatePath } from 'next/cache'

async function getToken(): Promise<string> {
  const supabase = await createClient()
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Not authenticated')
  return token
}

export async function listAllBlogPosts(): Promise<BlogPostDto[]> {
  const token = await getToken()
  return blogAdminApi.listAll(token)
}

export async function getBlogPost(id: string): Promise<BlogPostDto> {
  const token = await getToken()
  return blogAdminApi.getById(token, id)
}

export async function createBlogPost(data: BlogPostWriteDto): Promise<BlogPostDto> {
  const token = await getToken()
  const post = await blogAdminApi.create(token, data)
  revalidatePath('/blog')
  revalidatePath(`/blog/${post.slug}`)
  revalidatePath('/dashboard/blog')
  return post
}

export async function updateBlogPost(id: string, data: BlogPostWriteDto): Promise<void> {
  const token = await getToken()
  await blogAdminApi.update(token, id, data)
  revalidatePath('/blog')
  revalidatePath(`/blog/${data.slug}`)
  revalidatePath('/dashboard/blog')
}

export async function togglePublish(id: string, publish: boolean): Promise<void> {
  const token = await getToken()
  await blogAdminApi.togglePublish(token, id, publish)
  revalidatePath('/blog')
  revalidatePath('/dashboard/blog')
}

export async function deleteBlogPost(id: string): Promise<void> {
  const token = await getToken()
  await blogAdminApi.delete(token, id)
  revalidatePath('/blog')
  revalidatePath('/dashboard/blog')
}
