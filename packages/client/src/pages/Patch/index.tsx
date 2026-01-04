import { useState } from 'react'
import { useFixtures, useFixtureModels, useCreateFixture, useDeleteFixture } from '@/api'
import { useGroups, useCreateGroup, useDeleteGroup, useUpdateGroup } from '@/api'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, Trash2, Users } from 'lucide-react'
import type { Fixture, Group } from '@let-there-be-light/shared'

function FixturesTab() {
  const { data: fixtures = [], isLoading } = useFixtures()
  const { data: models = [] } = useFixtureModels()
  const createFixture = useCreateFixture()
  const deleteFixture = useDeleteFixture()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [newFixture, setNewFixture] = useState({
    name: '',
    modelId: '',
    universe: 0,
    startChannel: 1,
  })

  const handleCreate = () => {
    if (!newFixture.name || !newFixture.modelId) return
    createFixture.mutate(newFixture, {
      onSuccess: () => {
        setDialogOpen(false)
        setNewFixture({ name: '', modelId: '', universe: 0, startChannel: 1 })
      },
    })
  }

  if (isLoading) {
    return <div className="text-muted-foreground">Loading fixtures...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Fixtures</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Fixture
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Fixture</DialogTitle>
              <DialogDescription>
                Create a new fixture at a specific DMX address.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={newFixture.name}
                  onChange={(e) =>
                    setNewFixture({ ...newFixture, name: e.target.value })
                  }
                  placeholder="e.g., Front Left Par"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="model">Model</Label>
                <Select
                  value={newFixture.modelId}
                  onValueChange={(value) =>
                    setNewFixture({ ...newFixture, modelId: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a model" />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.brand} {model.model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="universe">Universe</Label>
                  <Input
                    id="universe"
                    type="number"
                    min={0}
                    value={newFixture.universe}
                    onChange={(e) =>
                      setNewFixture({
                        ...newFixture,
                        universe: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="startChannel">Start Channel</Label>
                  <Input
                    id="startChannel"
                    type="number"
                    min={1}
                    max={512}
                    value={newFixture.startChannel}
                    onChange={(e) =>
                      setNewFixture({
                        ...newFixture,
                        startChannel: parseInt(e.target.value) || 1,
                      })
                    }
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handleCreate}
                disabled={createFixture.isPending}
              >
                {createFixture.isPending ? 'Creating...' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Model</TableHead>
            <TableHead>Universe</TableHead>
            <TableHead>Channel</TableHead>
            <TableHead className="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {fixtures.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                No fixtures yet. Add one to get started.
              </TableCell>
            </TableRow>
          ) : (
            fixtures.map((fixture) => {
              const model = models.find((m) => m.id === fixture.modelId)
              return (
                <TableRow key={fixture.id}>
                  <TableCell className="font-medium">{fixture.name}</TableCell>
                  <TableCell>
                    {model ? `${model.brand} ${model.model}` : fixture.modelId}
                  </TableCell>
                  <TableCell>{fixture.universe}</TableCell>
                  <TableCell>{fixture.startChannel}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteFixture.mutate(fixture.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function GroupsTab() {
  const { data: groups = [], isLoading } = useGroups()
  const { data: fixtures = [] } = useFixtures()
  const createGroup = useCreateGroup()
  const deleteGroup = useDeleteGroup()
  const updateGroup = useUpdateGroup()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<Group | null>(null)
  const [newGroupName, setNewGroupName] = useState('')
  const [selectedFixtures, setSelectedFixtures] = useState<string[]>([])

  const handleCreate = () => {
    if (!newGroupName) return
    createGroup.mutate(
      { name: newGroupName, fixtureIds: selectedFixtures },
      {
        onSuccess: () => {
          setDialogOpen(false)
          setNewGroupName('')
          setSelectedFixtures([])
        },
      }
    )
  }

  const handleEditOpen = (group: Group) => {
    setEditingGroup(group)
    setSelectedFixtures(group.fixtureIds)
  }

  const handleEditSave = () => {
    if (!editingGroup) return
    updateGroup.mutate(
      {
        id: editingGroup.id,
        data: { fixtureIds: selectedFixtures },
        revision: editingGroup.revision,
      },
      {
        onSuccess: () => {
          setEditingGroup(null)
          setSelectedFixtures([])
        },
      }
    )
  }

  const toggleFixture = (fixtureId: string) => {
    setSelectedFixtures((prev) =>
      prev.includes(fixtureId)
        ? prev.filter((id) => id !== fixtureId)
        : [...prev, fixtureId]
    )
  }

  if (isLoading) {
    return <div className="text-muted-foreground">Loading groups...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Groups</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Group
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Group</DialogTitle>
              <DialogDescription>
                Create a group to control multiple fixtures together.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="groupName">Name</Label>
                <Input
                  id="groupName"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="e.g., Front Wash"
                />
              </div>
              <div className="grid gap-2">
                <Label>Fixtures</Label>
                <div className="max-h-48 overflow-y-auto rounded-md border p-2">
                  {fixtures.length === 0 ? (
                    <div className="text-sm text-muted-foreground">
                      No fixtures available. Create fixtures first.
                    </div>
                  ) : (
                    fixtures.map((fixture) => (
                      <label
                        key={fixture.id}
                        className="flex items-center gap-2 rounded p-1 hover:bg-muted"
                      >
                        <input
                          type="checkbox"
                          checked={selectedFixtures.includes(fixture.id)}
                          onChange={() => toggleFixture(fixture.id)}
                        />
                        <span className="text-sm">{fixture.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={createGroup.isPending}>
                {createGroup.isPending ? 'Creating...' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Group Dialog */}
      <Dialog
        open={!!editingGroup}
        onOpenChange={(open) => !open && setEditingGroup(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Group: {editingGroup?.name}</DialogTitle>
            <DialogDescription>
              Select which fixtures belong to this group.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Fixtures</Label>
              <div className="max-h-48 overflow-y-auto rounded-md border p-2">
                {fixtures.map((fixture) => (
                  <label
                    key={fixture.id}
                    className="flex items-center gap-2 rounded p-1 hover:bg-muted"
                  >
                    <input
                      type="checkbox"
                      checked={selectedFixtures.includes(fixture.id)}
                      onChange={() => toggleFixture(fixture.id)}
                    />
                    <span className="text-sm">{fixture.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleEditSave} disabled={updateGroup.isPending}>
              {updateGroup.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Fixtures</TableHead>
            <TableHead className="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} className="text-center text-muted-foreground">
                No groups yet. Add one to get started.
              </TableCell>
            </TableRow>
          ) : (
            groups.map((group) => (
              <TableRow key={group.id}>
                <TableCell className="font-medium">{group.name}</TableCell>
                <TableCell>{group.fixtureIds.length} fixtures</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEditOpen(group)}
                    >
                      <Users className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteGroup.mutate(group.id)}
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

export default function PatchPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Patch</h1>
        <p className="text-muted-foreground">
          Manage your fixtures and groups
        </p>
      </div>

      <Tabs defaultValue="fixtures" className="w-full">
        <TabsList>
          <TabsTrigger value="fixtures">Fixtures</TabsTrigger>
          <TabsTrigger value="groups">Groups</TabsTrigger>
        </TabsList>
        <TabsContent value="fixtures">
          <FixturesTab />
        </TabsContent>
        <TabsContent value="groups">
          <GroupsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
