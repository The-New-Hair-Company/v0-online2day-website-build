'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Save } from 'lucide-react'
import Link from 'next/link'

interface Project {
  id: string
  name: string
  description: string | null
  project_type: string | null
  budget: string | null
  timeline: string | null
  requirements: string | null
  technical_stack: string | null
  status: string
}

interface ProjectBuilderProps {
  userId: string
  project?: Project
}

export function ProjectBuilder({ userId, project }: ProjectBuilderProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [autoSaving, setAutoSaving] = useState(false)
  const [formData, setFormData] = useState({
    name: project?.name || '',
    description: project?.description || '',
    project_type: project?.project_type || '',
    budget: project?.budget || '',
    timeline: project?.timeline || '',
    requirements: project?.requirements || '',
    technical_stack: project?.technical_stack || '',
    status: project?.status || 'draft',
  })

  // Auto-save functionality
  useEffect(() => {
    if (!project) return // Don't auto-save new projects

    const timeoutId = setTimeout(async () => {
      if (formData.name.trim()) {
        setAutoSaving(true)
        const supabase = createClient()
        
        await supabase
          .from('projects')
          .update({
            ...formData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', project.id)

        setAutoSaving(false)
      }
    }, 2000)

    return () => clearTimeout(timeoutId)
  }, [formData, project])

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }))
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      const supabase = createClient()

      if (project) {
        // Update existing project
        const { error } = await supabase
          .from('projects')
          .update({
            ...formData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', project.id)

        if (error) throw error

        toast({
          title: 'Success',
          description: 'Project updated successfully',
        })
      } else {
        // Create new project
        const { error } = await supabase.from('projects').insert({
          ...formData,
          user_id: userId,
        })

        if (error) throw error

        toast({
          title: 'Success',
          description: 'Project created successfully',
        })
      }

      router.push('/dashboard')
      router.refresh()
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save project',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card className="p-6 bg-card border-border">
        <div className="space-y-6">
          <div>
            <Label htmlFor="name">Project Name *</Label>
            <Input
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="My Awesome Project"
              required
              disabled={loading}
              className="mt-2"
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Describe your project..."
              rows={4}
              disabled={loading}
              className="mt-2"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="project_type">Project Type</Label>
              <Select
                value={formData.project_type}
                onValueChange={(value) => handleSelectChange('project_type', value)}
                disabled={loading}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="web_app">Web Application</SelectItem>
                  <SelectItem value="saas">SaaS Platform</SelectItem>
                  <SelectItem value="ecommerce">E-commerce</SelectItem>
                  <SelectItem value="landing_page">Landing Page</SelectItem>
                  <SelectItem value="cms">CMS/Blog</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="budget">Budget</Label>
              <Select
                value={formData.budget}
                onValueChange={(value) => handleSelectChange('budget', value)}
                disabled={loading}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select budget" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="< £5,000">{'< £5,000'}</SelectItem>
                  <SelectItem value="£5,000 - £10,000">£5,000 - £10,000</SelectItem>
                  <SelectItem value="£10,000 - £25,000">£10,000 - £25,000</SelectItem>
                  <SelectItem value="£25,000 - £50,000">£25,000 - £50,000</SelectItem>
                  <SelectItem value="£50,000+">£50,000+</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="timeline">Timeline</Label>
              <Select
                value={formData.timeline}
                onValueChange={(value) => handleSelectChange('timeline', value)}
                disabled={loading}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select timeline" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="< 1 month">{'< 1 month'}</SelectItem>
                  <SelectItem value="1-3 months">1-3 months</SelectItem>
                  <SelectItem value="3-6 months">3-6 months</SelectItem>
                  <SelectItem value="6+ months">6+ months</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => handleSelectChange('status', value)}
                disabled={loading}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="requirements">Requirements</Label>
            <Textarea
              id="requirements"
              name="requirements"
              value={formData.requirements}
              onChange={handleChange}
              placeholder="List your project requirements..."
              rows={4}
              disabled={loading}
              className="mt-2"
            />
          </div>

          <div>
            <Label htmlFor="technical_stack">Technical Stack (Optional)</Label>
            <Textarea
              id="technical_stack"
              name="technical_stack"
              value={formData.technical_stack}
              onChange={handleChange}
              placeholder="e.g., Next.js, TypeScript, Tailwind CSS, Supabase..."
              rows={3}
              disabled={loading}
              className="mt-2"
            />
          </div>
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <Button type="button" variant="outline" asChild disabled={loading}>
          <Link href="/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>

        <div className="flex items-center gap-4">
          {autoSaving && (
            <span className="text-sm text-muted-foreground">Saving...</span>
          )}
          <Button type="submit" disabled={loading}>
            <Save className="mr-2 h-4 w-4" />
            {loading ? 'Saving...' : project ? 'Update Project' : 'Create Project'}
          </Button>
        </div>
      </div>
    </form>
  )
}
