import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGraphs, useCreateGraph, useDeleteGraph } from '@/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Plus, Trash2, Edit2, GitBranch } from 'lucide-react'

export default function GraphsPage() {
  const navigate = useNavigate()
  const { data: graphs = [], isLoading } = useGraphs()
  const createGraph = useCreateGraph()
  const deleteGraph = useDeleteGraph()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [newGraphName, setNewGraphName] = useState('')

  const handleCreate = () => {
    if (!newGraphName) return
    createGraph.mutate(
      {
        name: newGraphName,
        nodes: [],
        edges: [],
      },
      {
        onSuccess: (graph) => {
          setDialogOpen(false)
          setNewGraphName('')
          navigate(`/graphs/${graph.id}`)
        },
      }
    )
  }

  if (isLoading) {
    return <div className="text-muted-foreground">Loading graphs...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Graphs</h1>
        <p className="text-muted-foreground">
          Create and manage effect graphs
        </p>
      </div>

      <div className="flex items-center justify-between">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Graph
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Graph</DialogTitle>
              <DialogDescription>
                Create a new effect graph. You can add nodes and connections in the editor.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="graphName">Name</Label>
                <Input
                  id="graphName"
                  value={newGraphName}
                  onChange={(e) => setNewGraphName(e.target.value)}
                  placeholder="e.g., Main Show Graph"
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={createGraph.isPending}>
                {createGraph.isPending ? 'Creating...' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Nodes</TableHead>
            <TableHead>Edges</TableHead>
            <TableHead className="w-[150px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {graphs.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
                No graphs yet. Create one to get started.
              </TableCell>
            </TableRow>
          ) : (
            graphs.map((graph) => (
              <TableRow key={graph.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <GitBranch className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{graph.name}</span>
                  </div>
                </TableCell>
                <TableCell>{graph.nodes.length}</TableCell>
                <TableCell>{graph.edges.length}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => navigate(`/graphs/${graph.id}`)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteGraph.mutate(graph.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
