import { useState, useEffect } from 'react'
import {
  useFaders,
  useButtons,
  useCreateInput,
  useUpdateInput,
  useDeleteInput,
  useInputUsage,
} from '@/api'
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, Trash2, Pencil } from 'lucide-react'
import type { Input as InputEntity, InputType } from '@let-there-be-light/shared'

interface InputFormProps {
  type: InputType
  dialogOpen: boolean
  setDialogOpen: (open: boolean) => void
}

function AddInputDialog({ type, dialogOpen, setDialogOpen }: InputFormProps) {
  const createInput = useCreateInput()
  const [name, setName] = useState('')

  const handleCreate = () => {
    if (!name.trim()) return
    createInput.mutate(
      { name: name.trim(), type },
      {
        onSuccess: () => {
          setDialogOpen(false)
          setName('')
        },
      }
    )
  }

  const label = type === 'fader' ? 'Fader' : 'Button'

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Add {label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add {label}</DialogTitle>
          <DialogDescription>
            Create a new {type} input that can be used in graphs.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={type === 'fader' ? 'e.g., Master' : 'e.g., Blackout'}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleCreate} disabled={createInput.isPending || !name.trim()}>
            {createInput.isPending ? 'Creating...' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface EditInputDialogProps {
  input: InputEntity | null
  onClose: () => void
}

function EditInputDialog({ input, onClose }: EditInputDialogProps) {
  const updateInput = useUpdateInput()
  const [name, setName] = useState(input?.name ?? '')

  // Reset name when a different input is selected
  useEffect(() => {
    if (input) {
      setName(input.name)
    }
  }, [input?.id])

  const handleSave = () => {
    if (!input || !name.trim()) return
    updateInput.mutate(
      { id: input.id, data: { name: name.trim() }, revision: input.revision },
      { onSuccess: onClose }
    )
  }

  return (
    <Dialog open={!!input} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename {input?.type === 'fader' ? 'Fader' : 'Button'}</DialogTitle>
          <DialogDescription>
            Update the display name for this input.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="editName">Name</Label>
            <Input
              id="editName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={updateInput.isPending || !name.trim()}>
            {updateInput.isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface DeleteInputDialogProps {
  input: InputEntity | null
  onClose: () => void
}

function DeleteInputDialog({ input, onClose }: DeleteInputDialogProps) {
  const deleteInput = useDeleteInput()
  const { data: usage, isLoading: usageLoading } = useInputUsage(input?.id ?? '')

  const handleDelete = () => {
    if (!input) return
    deleteInput.mutate(input.id, { onSuccess: onClose })
  }

  const isUsed = usage && usage.usedBy.length > 0
  const label = input?.type === 'fader' ? 'fader' : 'button'

  return (
    <AlertDialog open={!!input} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isUsed ? `Cannot delete ${label}` : `Delete ${label}?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {usageLoading ? (
              'Checking usage...'
            ) : isUsed ? (
              <>
                <strong>{input?.name}</strong> is used by the following graphs and cannot
                be deleted:
                <ul className="mt-2 list-disc pl-4">
                  {usage.usedBy.map((g) => (
                    <li key={g.graphId}>{g.graphName}</li>
                  ))}
                </ul>
              </>
            ) : (
              <>
                Are you sure you want to delete <strong>{input?.name}</strong>? This
                action cannot be undone.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          {!isUsed && !usageLoading && (
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteInput.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function FadersTab() {
  const { data: faders = [], isLoading } = useFaders()
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editingInput, setEditingInput] = useState<InputEntity | null>(null)
  const [deletingInput, setDeletingInput] = useState<InputEntity | null>(null)

  if (isLoading) {
    return <div className="text-muted-foreground">Loading faders...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Faders</h2>
        <AddInputDialog
          type="fader"
          dialogOpen={addDialogOpen}
          setDialogOpen={setAddDialogOpen}
        />
      </div>

      <EditInputDialog input={editingInput} onClose={() => setEditingInput(null)} />
      <DeleteInputDialog input={deletingInput} onClose={() => setDeletingInput(null)} />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead className="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {faders.length === 0 ? (
            <TableRow>
              <TableCell colSpan={2} className="text-center text-muted-foreground">
                No faders yet. Add one to get started.
              </TableCell>
            </TableRow>
          ) : (
            faders.map((fader) => (
              <TableRow key={fader.id}>
                <TableCell className="font-medium">{fader.name}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditingInput(fader)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeletingInput(fader)}
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

function ButtonsTab() {
  const { data: buttons = [], isLoading } = useButtons()
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editingInput, setEditingInput] = useState<InputEntity | null>(null)
  const [deletingInput, setDeletingInput] = useState<InputEntity | null>(null)

  if (isLoading) {
    return <div className="text-muted-foreground">Loading buttons...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Buttons</h2>
        <AddInputDialog
          type="button"
          dialogOpen={addDialogOpen}
          setDialogOpen={setAddDialogOpen}
        />
      </div>

      <EditInputDialog input={editingInput} onClose={() => setEditingInput(null)} />
      <DeleteInputDialog input={deletingInput} onClose={() => setDeletingInput(null)} />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead className="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {buttons.length === 0 ? (
            <TableRow>
              <TableCell colSpan={2} className="text-center text-muted-foreground">
                No buttons yet. Add one to get started.
              </TableCell>
            </TableRow>
          ) : (
            buttons.map((button) => (
              <TableRow key={button.id}>
                <TableCell className="font-medium">{button.name}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditingInput(button)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeletingInput(button)}
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

export default function InputsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Inputs</h1>
        <p className="text-muted-foreground">
          Manage faders and buttons for use in graphs
        </p>
      </div>

      <Tabs defaultValue="faders" className="w-full">
        <TabsList>
          <TabsTrigger value="faders">Faders</TabsTrigger>
          <TabsTrigger value="buttons">Buttons</TabsTrigger>
        </TabsList>
        <TabsContent value="faders">
          <FadersTab />
        </TabsContent>
        <TabsContent value="buttons">
          <ButtonsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
