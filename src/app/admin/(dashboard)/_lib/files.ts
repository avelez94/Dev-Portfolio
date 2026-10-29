/** Files in the private freelance-docs bucket, through the authenticated data route. */
import { supabase } from '@/lib/supabase-admin-browser'

export async function downloadDoc(path: string, name: string) {
  const { data } = await supabase.storage.from('freelance-docs').download(path)
  if (!data) return
  const url = URL.createObjectURL(data)
  const a = document.createElement('a'); a.href = url; a.download = name; a.click()
  URL.revokeObjectURL(url)
}

export async function deleteDocument(id: string, path: string) {
  await supabase.storage.from('freelance-docs').remove([path])
  await supabase.from('documents').delete().eq('id', id)
}

/** Uploads a template (not attached to any client). Returns false when the upload fails. */
export async function uploadTemplate(file: File) {
  const path = 'templates/' + Date.now() + '-' + file.name
  const { error } = await supabase.storage.from('freelance-docs').upload(path, file)
  if (error) return false
  await supabase.from('documents').insert({ name: file.name, type: 'other', storage_path: path, client_id: null })
  return true
}
