import { useState } from 'react'
import { usePresets, useCreatePreset, useDeletePreset } from '@/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, Trash2 } from 'lucide-react'
import type { PresetType, AttributeBundle } from '@let-there-be-light/shared'

function ColorPresets() {
  const { data: presets = [], isLoading } = usePresets('color')
  const createPreset = useCreatePreset()
  const deletePreset = useDeletePreset()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [name, setName] = useState('')
  const [color, setColor] = useState({ r: 1, g: 1, b: 1 })

  const handleCreate = () => {
    if (!name) return
    createPreset.mutate(
      {
        name,
        type: 'color' as PresetType,
        attributes: { color },
      },
      {
        onSuccess: () => {
          setDialogOpen(false)
          setName('')
          setColor({ r: 1, g: 1, b: 1 })
        },
      }
    )
  }

  const colorToCSS = (c: { r: number; g: number; b: number }) =>
    `rgb(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)})`

  if (isLoading) {
    return <div className="text-muted-foreground">Loading presets...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Color Presets</h3>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Color Preset
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Color Preset</DialogTitle>
              <DialogDescription>Create a reusable color preset.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Deep Blue"
                />
              </div>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label>Red: {Math.round(color.r * 255)}</Label>
                  <Slider
                    value={[color.r]}
                    min={0}
                    max={1}
                    step={0.01}
                    onValueChange={([v]) => setColor({ ...color, r: v })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Green: {Math.round(color.g * 255)}</Label>
                  <Slider
                    value={[color.g]}
                    min={0}
                    max={1}
                    step={0.01}
                    onValueChange={([v]) => setColor({ ...color, g: v })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Blue: {Math.round(color.b * 255)}</Label>
                  <Slider
                    value={[color.b]}
                    min={0}
                    max={1}
                    step={0.01}
                    onValueChange={([v]) => setColor({ ...color, b: v })}
                  />
                </div>
                <div
                  className="h-12 rounded-md border"
                  style={{ backgroundColor: colorToCSS(color) }}
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={createPreset.isPending}>
                {createPreset.isPending ? 'Creating...' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Color</TableHead>
            <TableHead className="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {presets.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} className="text-center text-muted-foreground">
                No color presets yet.
              </TableCell>
            </TableRow>
          ) : (
            presets.map((preset) => (
              <TableRow key={preset.id}>
                <TableCell className="font-medium">{preset.name}</TableCell>
                <TableCell>
                  {preset.attributes.color && (
                    <div className="flex items-center gap-2">
                      <div
                        className="h-6 w-6 rounded border"
                        style={{
                          backgroundColor: colorToCSS(preset.attributes.color),
                        }}
                      />
                      <span className="text-sm text-muted-foreground">
                        RGB({Math.round(preset.attributes.color.r * 255)},{' '}
                        {Math.round(preset.attributes.color.g * 255)},{' '}
                        {Math.round(preset.attributes.color.b * 255)})
                      </span>
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deletePreset.mutate(preset.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function PositionPresets() {
  const { data: presets = [], isLoading } = usePresets('position')
  const createPreset = useCreatePreset()
  const deletePreset = useDeletePreset()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [name, setName] = useState('')
  const [position, setPosition] = useState({ pan: 0, tilt: 0 })

  const handleCreate = () => {
    if (!name) return
    createPreset.mutate(
      {
        name,
        type: 'position' as PresetType,
        attributes: position,
      },
      {
        onSuccess: () => {
          setDialogOpen(false)
          setName('')
          setPosition({ pan: 0, tilt: 0 })
        },
      }
    )
  }

  if (isLoading) {
    return <div className="text-muted-foreground">Loading presets...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Position Presets</h3>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Position Preset
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Position Preset</DialogTitle>
              <DialogDescription>Create a reusable position preset.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Center Stage"
                />
              </div>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label>Pan: {position.pan.toFixed(2)}</Label>
                  <Slider
                    value={[position.pan]}
                    min={-1}
                    max={1}
                    step={0.01}
                    onValueChange={([v]) => setPosition({ ...position, pan: v })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Tilt: {position.tilt.toFixed(2)}</Label>
                  <Slider
                    value={[position.tilt]}
                    min={-1}
                    max={1}
                    step={0.01}
                    onValueChange={([v]) => setPosition({ ...position, tilt: v })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={createPreset.isPending}>
                {createPreset.isPending ? 'Creating...' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Pan</TableHead>
            <TableHead>Tilt</TableHead>
            <TableHead className="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {presets.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
                No position presets yet.
              </TableCell>
            </TableRow>
          ) : (
            presets.map((preset) => (
              <TableRow key={preset.id}>
                <TableCell className="font-medium">{preset.name}</TableCell>
                <TableCell>{preset.attributes.pan?.toFixed(2) ?? '-'}</TableCell>
                <TableCell>{preset.attributes.tilt?.toFixed(2) ?? '-'}</TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deletePreset.mutate(preset.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function BeamPresets() {
  const { data: presets = [], isLoading } = usePresets('beam')
  const createPreset = useCreatePreset()
  const deletePreset = useDeletePreset()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [name, setName] = useState('')
  const [beam, setBeam] = useState({ intensity: 1, zoom: 0.5 })

  const handleCreate = () => {
    if (!name) return
    createPreset.mutate(
      {
        name,
        type: 'beam' as PresetType,
        attributes: beam,
      },
      {
        onSuccess: () => {
          setDialogOpen(false)
          setName('')
          setBeam({ intensity: 1, zoom: 0.5 })
        },
      }
    )
  }

  if (isLoading) {
    return <div className="text-muted-foreground">Loading presets...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Beam Presets</h3>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Beam Preset
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Beam Preset</DialogTitle>
              <DialogDescription>Create a reusable beam preset.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Tight Spot"
                />
              </div>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label>Intensity: {Math.round(beam.intensity * 100)}%</Label>
                  <Slider
                    value={[beam.intensity]}
                    min={0}
                    max={1}
                    step={0.01}
                    onValueChange={([v]) => setBeam({ ...beam, intensity: v })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Zoom: {Math.round(beam.zoom * 100)}%</Label>
                  <Slider
                    value={[beam.zoom]}
                    min={0}
                    max={1}
                    step={0.01}
                    onValueChange={([v]) => setBeam({ ...beam, zoom: v })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={createPreset.isPending}>
                {createPreset.isPending ? 'Creating...' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Intensity</TableHead>
            <TableHead>Zoom</TableHead>
            <TableHead className="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {presets.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
                No beam presets yet.
              </TableCell>
            </TableRow>
          ) : (
            presets.map((preset) => (
              <TableRow key={preset.id}>
                <TableCell className="font-medium">{preset.name}</TableCell>
                <TableCell>
                  {preset.attributes.intensity !== undefined
                    ? `${Math.round(preset.attributes.intensity * 100)}%`
                    : '-'}
                </TableCell>
                <TableCell>
                  {preset.attributes.zoom !== undefined
                    ? `${Math.round(preset.attributes.zoom * 100)}%`
                    : '-'}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deletePreset.mutate(preset.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

export default function PresetsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Presets</h1>
        <p className="text-muted-foreground">
          Manage reusable attribute bundles
        </p>
      </div>

      <Tabs defaultValue="color" className="w-full">
        <TabsList>
          <TabsTrigger value="color">Color</TabsTrigger>
          <TabsTrigger value="position">Position</TabsTrigger>
          <TabsTrigger value="beam">Beam</TabsTrigger>
        </TabsList>
        <TabsContent value="color">
          <ColorPresets />
        </TabsContent>
        <TabsContent value="position">
          <PositionPresets />
        </TabsContent>
        <TabsContent value="beam">
          <BeamPresets />
        </TabsContent>
      </Tabs>
    </div>
  )
}
