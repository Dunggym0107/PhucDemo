'use client'

import React, { useState, useEffect } from "react";
import { 
 Users, 
 ShieldCheck, 
 Search,
 UserCheck,
 Loader2,
 ShieldAlert,
 DoorOpen,
 Car,
 Plus,
 Trash2,
 MapPin,
 Hash,
 Activity,
 CheckCircle2,
 Phone,
 Pencil
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useRouter, useSearchParams } from "next/navigation";
import { 
 Table, 
 TableBody, 
 TableCell, 
 TableHead, 
 TableHeader, 
 TableRow 
} from "@/components/ui/table";
import { 
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from "@/components/ui/select";
import { 
 Tabs, 
 TabsContent, 
 TabsList, 
 TabsTrigger 
} from "@/components/ui/tabs";
import {
 Dialog,
 DialogContent,
 DialogFooter,
 DialogHeader,
 DialogTitle,
 DialogTrigger,
 DialogDescription,
} from "@/components/ui/dialog";
import { cn, getProfileDisplayTitle, getProfileTitleBadgeClass, sortProfilesByHierarchy } from "@/lib/utils";
import { createClient } from "@/utils/supabase/client";

import { useAdmin } from "./_hooks/useAdmin";
import PageHeader from "@/components/layout/PageHeader";
import { ListSkeleton } from "@/components/ui/list-skeleton";

export default function AdminPage() {
  const adminProps = useAdmin();
  const {
    loading, userProfile, users, rooms, vehicles, stats, searchQuery, setSearchQuery, drivers,
    newRoom, setNewRoom, isRoomOpen, setIsRoomOpen, newVehicle, setNewVehicle, isVehicleOpen, setIsVehicleOpen,
    editingRoom, setEditingRoom, isEditRoomOpen, setIsEditRoomOpen, editingVehicle, setEditingVehicle, isEditVehicleOpen, setIsEditVehicleOpen,
    handleUpdateRole, handleCreateRoom, handleCreateVehicle, handleUpdateRoom, handleUpdateVehicle, handleDeleteRoom, handleDeleteVehicle
  } = adminProps;

  if (loading) {
    return (
      <div className="page-container space-y-10 motion-safe:animate-fade-in-up">
        <PageHeader
          title="Quản trị Hệ thống"
          description="Toàn quyền cấu hình hệ thống bankportal"
        />
        <ListSkeleton variant="table" rows={6} />
      </div>
    );
  }

 const isAdmin = userProfile?.role === 'admin';
 const normalizedSearch = searchQuery.trim().toLowerCase();
 const filteredUsers = users.filter((user) => {
 const name = user.full_name ?? "";
 const title = getProfileDisplayTitle(user);
 const departmentName = user.departments?.name ?? "";
 return (
 name.toLowerCase().includes(normalizedSearch) ||
 title.toLowerCase().includes(normalizedSearch) ||
 departmentName.toLowerCase().includes(normalizedSearch)
 );
 });

 return (
 <div className="page-container space-y-10 motion-safe:animate-fade-in-up">
 <PageHeader
   title="Quản trị Hệ thống"
   description="Toàn quyền cấu hình hệ thống bankportal"
 />

 {/* Stats */}
 {isAdmin && (
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
 <Card className="border-none shadow-sm rounded-2xl bg-blue-50/50">
 <CardContent className="p-6 flex items-center gap-4">
 <div className="p-3 bg-white rounded-2xl shadow-sm text-blue-600">
 <Users className="w-6 h-6" />
 </div>
 <div>
 <p className="text-label leading-none mb-1 truncate whitespace-nowrap">Cán bộ</p>
 <p className="text-2xl font-bold text-slate-800 tabular-nums">{stats.members}</p>
 </div>
 </CardContent>
 </Card>
  <Card className="border-none shadow-sm rounded-2xl bg-amber-50/50">
  <CardContent className="p-6 flex items-center gap-4">
  <div className="p-3 bg-white rounded-2xl shadow-sm text-amber-600">
  <DoorOpen className="w-6 h-6" />
  </div>
  <div>
  <p className="text-label leading-none mb-1 truncate whitespace-nowrap">Phòng họp</p>
  <p className="text-2xl font-bold text-slate-800 tabular-nums">{rooms.length}</p>
  </div>
  </CardContent>
  </Card>
 <Card className="border-none shadow-sm rounded-2xl bg-emerald-50/50">
 <CardContent className="p-6 flex items-center gap-4">
 <div className="p-3 bg-white rounded-2xl shadow-sm text-emerald-600">
 <Car className="w-6 h-6" />
 </div>
 <div>
 <p className="text-label leading-none mb-1 truncate whitespace-nowrap">Đội xe</p>
 <p className="text-2xl font-bold text-slate-800 tabular-nums">{vehicles.length}</p>
 </div>
 </CardContent>
 </Card>
 </div>
 )}

 <Tabs defaultValue={isAdmin ? "users" : "rooms"} className="section-stack">
  <TabsList className="h-11 border border-slate-100">
  {isAdmin && (
    <TabsTrigger value="users" className="flex-1 rounded-lg px-2 sm:px-6 py-1.5 font-medium text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm flex items-center justify-center">
    <Users className="w-3.5 h-3.5 mr-1.5 shrink-0" /> <span className="truncate">Cán bộ</span>
    </TabsTrigger>
  )}
  <TabsTrigger value="rooms" className="flex-1 rounded-lg px-2 sm:px-6 py-1.5 font-medium text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm flex items-center justify-center">
  <DoorOpen className="w-3.5 h-3.5 mr-1.5 shrink-0" /> <span className="truncate">Phòng họp</span>
  </TabsTrigger>
  <TabsTrigger value="vehicles" className="flex-1 rounded-lg px-2 sm:px-6 py-1.5 font-medium text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm flex items-center justify-center">
  <Car className="w-3.5 h-3.5 mr-1.5 shrink-0" /> <span className="truncate">Đội xe</span>
  </TabsTrigger>
  </TabsList>

  {/* User Management Tab (Admin Only) */}
  {isAdmin && (
    <TabsContent value="users" className="animate-in fade-in slide-in-from-bottom-2 duration-500">
    <Card className="border-none shadow-sm rounded-2xl overflow-hidden">
    <CardHeader className="bg-slate-50/50 pb-6 border-b border-slate-100">
    <div className="flex items-center justify-between">
    <CardTitle className="text-lg font-bold text-slate-800">Danh sách Cán bộ Hệ thống</CardTitle>
    <div className="relative w-72">
    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
    <Input 
    placeholder="Tìm theo tên, chức danh..." 
    className="pl-11 h-11 bg-white border-none rounded-2xl shadow-sm font-bold"
    value={searchQuery}
    onChange={(e) => setSearchQuery(e.target.value)}
    />
    </div>
    </div>
    </CardHeader>
    <CardContent className="p-0">
    <Table>
    <TableHeader>
    <TableRow className="border-slate-100 bg-slate-50/30">
    <TableHead className="pl-8 font-medium text-sm text-slate-500 truncate whitespace-nowrap">Cán bộ</TableHead>
    <TableHead className="font-medium text-sm text-slate-500 truncate whitespace-nowrap">Bộ phận</TableHead>
    <TableHead className="font-medium text-sm text-slate-500 text-center truncate whitespace-nowrap">Chức danh</TableHead>
    <TableHead className="pr-8 font-medium text-sm text-slate-500 text-right truncate whitespace-nowrap">Quyền hệ thống</TableHead>
    </TableRow>
    </TableHeader>
    <TableBody>
    {filteredUsers.map(u => (
    <TableRow key={u.id} className="border-slate-50 hover:bg-slate-50/50 transition-colors">
    <TableCell className="pl-8 py-5">
    <div className="flex items-center gap-3">
    <Avatar className="h-11 w-11 border-2 border-white shadow-sm">
    <AvatarImage src={u.avatar_url} />
    <AvatarFallback className="bg-primary text-white font-bold">{u.full_name?.[0] ?? "?"}</AvatarFallback>
    </Avatar>
    <span className="font-bold text-slate-700">{u.full_name || "Chưa cập nhật tên"}</span>
    </div>
    </TableCell>
    <TableCell className="text-sm font-medium text-slate-600 truncate whitespace-nowrap">{u.departments?.name || "Chi nhánh"}</TableCell>
    <TableCell className="text-center">
    <Badge className={cn("text-xs font-medium px-2.5 py-1 rounded-full", getProfileTitleBadgeClass(u))}>{getProfileDisplayTitle(u)}</Badge>
    </TableCell>
    <TableCell className="pr-8 text-right">
    <Select defaultValue={u.role} onValueChange={(v) => handleUpdateRole(u.id, v)}>
    <SelectTrigger className="w-32 h-9 text-xs md:text-sm font-medium ml-auto bg-slate-50 border-none rounded-xl">
    <SelectValue />
    </SelectTrigger>
    <SelectContent className="rounded-xl border-none shadow-2xl">
    <SelectItem value="admin">Quản trị hệ thống</SelectItem>
    <SelectItem value="director">Ban Giám đốc</SelectItem>
    <SelectItem value="manager">Trưởng phòng</SelectItem>
    <SelectItem value="staff">Cán bộ</SelectItem>
    </SelectContent>
    </Select>
    </TableCell>
    </TableRow>
    ))}
    </TableBody>
    </Table>
    </CardContent>
    </Card>
    </TabsContent>
  )}

 {/* Rooms Tab */}
 <TabsContent value="rooms" className="group-stack animate-in fade-in slide-in-from-bottom-2 duration-500">
 <div className="flex justify-end">
 <Dialog open={isRoomOpen} onOpenChange={setIsRoomOpen}>
 <DialogTrigger asChild>
 <Button className="min-h-11 px-4 rounded-xl bg-primary shadow-lg shadow-primary/20 font-medium text-sm truncate whitespace-nowrap">
 <Plus className="w-4 h-4 mr-2" /> Thêm phòng họp
 </Button>
 </DialogTrigger>
 <DialogContent className="rounded-2xl border-none shadow-2xl" aria-describedby={undefined}>
 <DialogHeader>
   <DialogTitle className="text-xl font-bold tabular-nums">Thiết lập phòng họp mới</DialogTitle>
   <DialogDescription className="sr-only">Form thêm phòng họp mới</DialogDescription>
 </DialogHeader>
 <div className="group-stack py-4">
 <div className="space-y-2">
 <Label className="text-label pl-1 truncate whitespace-nowrap">Tên phòng họp</Label>
 <Input placeholder="VD: Phòng Hội thảo Tầng 2..." className="min-h-11 bg-slate-50 border-none rounded-xl font-medium text-sm" value={newRoom.name} onChange={e => setNewRoom({...newRoom, name: e.target.value})} />
 </div>
 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label className="text-label pl-1 truncate whitespace-nowrap">Sức chứa (Người)</Label>
 <Input type="number" className="min-h-11 bg-slate-50 border-none rounded-xl font-medium text-sm" value={newRoom.capacity} onChange={e => setNewRoom({...newRoom, capacity: parseInt(e.target.value)})} />
 </div>
 <div className="space-y-2">
 <Label className="text-label pl-1 truncate whitespace-nowrap">Vị trí</Label>
 <Input placeholder="Vd: tầng 2 - Khu B" className="min-h-11 bg-slate-50 border-none rounded-xl font-medium text-sm" value={newRoom.location} onChange={e => setNewRoom({...newRoom, location: e.target.value})} />
 </div>
 </div>
 </div>
 <DialogFooter><Button onClick={handleCreateRoom} className="w-full sm:w-auto min-h-11 rounded-xl bg-primary font-medium px-4">Xác nhận tạo phòng</Button></DialogFooter>
 </DialogContent>
 </Dialog>
 </div>
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
 {rooms.map(room => (
 <Card key={room.id} className="border-none shadow-sm rounded-2xl overflow-hidden group hover:shadow-xl transition-all duration-500">
 <CardContent className="p-8 space-y-4">
 <div className="flex justify-between items-start">
 <div className="p-4 bg-amber-50 rounded-2xl text-amber-600">
        <DoorOpen className="w-6 h-6" />
       </div>
       <div className="flex gap-2">
        <Button variant="ghost" size="icon" className="h-11 w-11 text-slate-500 hover:text-blue-500 rounded-2xl" onClick={() => { setEditingRoom(room); setIsEditRoomOpen(true); }}>
         <Pencil className="w-5 h-5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-11 w-11 text-slate-500 hover:text-red-500 rounded-2xl" onClick={() => handleDeleteRoom(room)}>
         <Trash2 className="w-5 h-5" />
        </Button>
       </div>
 </div>
 <div>
 <h3 className="text-lg font-bold text-slate-800">{room.name}</h3>
 <div className="flex items-center gap-4 mt-2">
 <div className="flex items-center gap-1.5 text-slate-500">
 <Users className="w-3.5 h-3.5" />
 <span className="text-sm font-medium truncate whitespace-nowrap">{room.capacity} chỗ</span>
 </div>
 <div className="flex items-center gap-1.5 text-slate-500">
 <MapPin className="w-3.5 h-3.5" />
 <span className="text-sm font-medium truncate whitespace-nowrap">{room.location}</span>
 </div>
 </div>
 </div>
 </CardContent>
 </Card>
 ))}
   </div>
  <Dialog open={isEditRoomOpen} onOpenChange={setIsEditRoomOpen}>
   <DialogContent className="rounded-2xl border-none shadow-2xl" aria-describedby={undefined}>
    <DialogHeader>
      <DialogTitle className="text-xl font-bold tabular-nums">Sửa phòng họp</DialogTitle>
      <DialogDescription className="sr-only">Form sửa thông tin phòng họp</DialogDescription>
    </DialogHeader>
    {editingRoom && (
     <div className="group-stack py-4">
      <div className="space-y-2">
       <Label className="text-label pl-1 truncate whitespace-nowrap">Tên phòng họp</Label>
       <Input placeholder="VD: Phòng Hội thảo Tầng 2..." className="min-h-11 bg-slate-50 border-none rounded-xl font-medium text-sm" value={editingRoom.name} onChange={e => setEditingRoom({...editingRoom, name: e.target.value})} />
      </div>
      <div className="grid grid-cols-2 gap-4">
       <div className="space-y-2">
        <Label className="text-label pl-1 truncate whitespace-nowrap">Sức chứa (Người)</Label>
        <Input type="number" className="min-h-11 bg-slate-50 border-none rounded-xl font-medium text-sm" value={editingRoom.capacity} onChange={e => setEditingRoom({...editingRoom, capacity: parseInt(e.target.value)})} />
       </div>
       <div className="space-y-2">
        <Label className="text-label pl-1 truncate whitespace-nowrap">Vị trí</Label>
        <Input placeholder="Vd: tầng 2 - Khu B" className="min-h-11 bg-slate-50 border-none rounded-xl font-medium text-sm" value={editingRoom.location} onChange={e => setEditingRoom({...editingRoom, location: e.target.value})} />
       </div>
      </div>
     </div>
    )}
    <DialogFooter><Button onClick={handleUpdateRoom} className="w-full sm:w-auto min-h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium px-4">Lưu thay đổi</Button></DialogFooter>
   </DialogContent>
  </Dialog>
 </TabsContent>

  {/* Vehicles Tab */}
 <TabsContent value="vehicles" className="group-stack animate-in fade-in slide-in-from-bottom-2 duration-500">
 <div className="flex justify-end">
 <Dialog open={isVehicleOpen} onOpenChange={setIsVehicleOpen}>
 <DialogTrigger asChild>
 <Button className="min-h-11 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/20 font-medium text-sm text-white truncate whitespace-nowrap">
 <Plus className="w-4 h-4 mr-2" /> Thêm xe mới
 </Button>
 </DialogTrigger>
 <DialogContent className="rounded-2xl border-none shadow-2xl" aria-describedby={undefined}>
 <DialogHeader>
   <DialogTitle className="text-xl font-bold tabular-nums">Bổ sung Xe & Lái xe</DialogTitle>
   <DialogDescription className="sr-only">Form thêm xe mới</DialogDescription>
 </DialogHeader>
 <div className="group-stack py-4">
 <div className="space-y-2">
 <Label className="text-label pl-1 truncate whitespace-nowrap">Tên xe / Hãng xe</Label>
 <Input placeholder="VD: Toyota Fortuner..." className="min-h-11 bg-slate-50 border-none rounded-xl font-medium text-sm" value={newVehicle.name} onChange={e => setNewVehicle({...newVehicle, name: e.target.value})} />
 </div>
 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label className="text-label pl-1 truncate whitespace-nowrap">Biển số</Label>
 <Input placeholder="VD: 30A-123.45" className="min-h-11 bg-slate-50 border-none rounded-xl font-medium text-sm truncate whitespace-nowrap" value={newVehicle.plate_number} onChange={e => setNewVehicle({...newVehicle, plate_number: e.target.value})} />
 </div>
 <div className="space-y-2">
 <Label className="text-label pl-1 truncate whitespace-nowrap">Loại xe</Label>
 <Select value={newVehicle.type} onValueChange={v => setNewVehicle({...newVehicle, type: v})}>
 <SelectTrigger className="min-h-11 bg-slate-50 border-none rounded-xl font-medium text-sm"><SelectValue /></SelectTrigger>
 <SelectContent className="rounded-2xl">
 <SelectItem value="4 chỗ" className="text-base md:text-sm py-3 md:py-2">Xe 4 chỗ</SelectItem>
 <SelectItem value="7 chỗ" className="text-base md:text-sm py-3 md:py-2">Xe 7 chỗ</SelectItem>
 <SelectItem value="Khác" className="text-base md:text-sm py-3 md:py-2">Loại khác</SelectItem>
 </SelectContent>
 </Select>
 </div>
 </div>
 <div className="grid grid-cols-1 gap-4">
 <div className="space-y-2">
 <Label className="text-label pl-1 truncate whitespace-nowrap">Lái xe phụ trách (Tùy chọn)</Label>
 <Select value={newVehicle.driver_id || "none"} onValueChange={v => setNewVehicle({...newVehicle, driver_id: v})}>
 <SelectTrigger className="min-h-11 bg-slate-50 border-none rounded-xl font-medium text-sm"><SelectValue /></SelectTrigger>
 <SelectContent className="rounded-2xl">
 <SelectItem value="none" className="text-base md:text-sm py-3 md:py-2">Chưa gán lái xe</SelectItem>
 {drivers.map(d => <SelectItem key={d.id} value={d.id} className="text-base md:text-sm py-3 md:py-2">{d.full_name} {d.phone ? `- ${d.phone}` : ''}</SelectItem>)}
 </SelectContent>
 </Select>
 </div>
 </div>
 </div>
 <DialogFooter><Button onClick={handleCreateVehicle} className="w-full sm:w-auto min-h-11 rounded-xl bg-emerald-600 text-white font-medium px-4">Lưu thông tin</Button></DialogFooter>
 </DialogContent>
 </Dialog>
 </div>
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
 {vehicles.map(v => (
 <Card key={v.id} className="border-none shadow-sm rounded-2xl overflow-hidden group hover:shadow-xl transition-all duration-500">
 <CardContent className="p-8 group-stack">
 <div className="flex justify-between items-start">
 <div className="p-4 bg-emerald-50 rounded-2xl text-emerald-600">
        <Car className="w-6 h-6" />
       </div>
       <div className="flex gap-2">
        <Button variant="ghost" size="icon" className="h-11 w-11 text-slate-500 hover:text-blue-500 rounded-2xl" onClick={() => { setEditingVehicle(v); setIsEditVehicleOpen(true); }}>
         <Pencil className="w-5 h-5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-11 w-11 text-slate-500 hover:text-red-500 rounded-2xl" onClick={() => handleDeleteVehicle(v)}>
         <Trash2 className="w-5 h-5" />
        </Button>
       </div>
 </div>
 <div className="space-y-4">
 <div>
 <h3 className="text-lg font-bold text-slate-800 leading-tight">{v.name}</h3>
 <Badge variant="outline" className="mt-2 font-bold border-slate-100 text-slate-500 text-xs px-2.5 py-1 rounded-lg">
 <Hash className="w-2.5 h-2.5 mr-1.5" /> {v.plate_number} • {v.type}
 </Badge>
 </div>
 <div className="p-4 bg-slate-50 rounded-2xl space-y-2">
 <div className="flex items-center justify-between">
 <p className="text-label truncate whitespace-nowrap">Lái xe phụ trách</p>
 <Phone className="w-3 h-3 text-emerald-600" />
 </div>
 <p className="text-sm font-medium text-slate-700">{v.driver?.full_name || v.driver_name || "Chưa gán"}</p>
 <p className="text-sm font-medium text-emerald-600">{v.driver?.phone || v.driver_phone || "---"}</p>
 </div>
 </div>
 </CardContent>
 </Card>
 ))}
   </div>
  <Dialog open={isEditVehicleOpen} onOpenChange={setIsEditVehicleOpen}>
   <DialogContent className="rounded-2xl border-none shadow-2xl" aria-describedby={undefined}>
    <DialogHeader>
      <DialogTitle className="text-xl font-bold tabular-nums">Sửa thông tin Xe & Lái xe</DialogTitle>
      <DialogDescription className="sr-only">Form sửa thông tin xe</DialogDescription>
    </DialogHeader>
    {editingVehicle && (
     <div className="group-stack py-4">
      <div className="space-y-2">
       <Label className="text-label pl-1 truncate whitespace-nowrap">Tên xe / Hãng xe</Label>
       <Input placeholder="VD: Toyota Fortuner..." className="min-h-11 bg-slate-50 border-none rounded-xl font-medium text-sm" value={editingVehicle.name} onChange={e => setEditingVehicle({...editingVehicle, name: e.target.value})} />
      </div>
      <div className="grid grid-cols-2 gap-4">
       <div className="space-y-2">
        <Label className="text-label pl-1 truncate whitespace-nowrap">Biển số</Label>
        <Input placeholder="VD: 30A-123.45" className="min-h-11 bg-slate-50 border-none rounded-xl font-medium text-sm truncate whitespace-nowrap" value={editingVehicle.plate_number} onChange={e => setEditingVehicle({...editingVehicle, plate_number: e.target.value})} />
       </div>
       <div className="space-y-2">
        <Label className="text-label pl-1 truncate whitespace-nowrap">Loại xe</Label>
        <Select value={editingVehicle.type} onValueChange={val => setEditingVehicle({...editingVehicle, type: val})}>
         <SelectTrigger className="min-h-11 bg-slate-50 border-none rounded-xl font-medium text-sm"><SelectValue /></SelectTrigger>
         <SelectContent className="rounded-2xl">
          <SelectItem value="4 chỗ" className="text-base md:text-sm py-3 md:py-2">Xe 4 chỗ</SelectItem>
          <SelectItem value="7 chỗ" className="text-base md:text-sm py-3 md:py-2">Xe 7 chỗ</SelectItem>
          <SelectItem value="Khác" className="text-base md:text-sm py-3 md:py-2">Loại khác</SelectItem>
         </SelectContent>
        </Select>
       </div>
      </div>
      <div className="grid grid-cols-1 gap-4">
       <div className="space-y-2">
        <Label className="text-label pl-1 truncate whitespace-nowrap">Lái xe phụ trách (Tùy chọn)</Label>
        <Select value={editingVehicle.driver_id || "none"} onValueChange={val => setEditingVehicle({...editingVehicle, driver_id: val})}>
         <SelectTrigger className="min-h-11 bg-slate-50 border-none rounded-xl font-medium text-sm"><SelectValue /></SelectTrigger>
         <SelectContent className="rounded-2xl">
          <SelectItem value="none" className="text-base md:text-sm py-3 md:py-2">Chưa gán lái xe</SelectItem>
          {drivers.map(d => <SelectItem key={d.id} value={d.id} className="text-base md:text-sm py-3 md:py-2">{d.full_name} {d.phone ? `- ${d.phone}` : ''}</SelectItem>)}
         </SelectContent>
        </Select>
       </div>
      </div>
     </div>
    )}
    <DialogFooter><Button onClick={handleUpdateVehicle} className="w-full sm:w-auto min-h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium px-4">Lưu thay đổi</Button></DialogFooter>
   </DialogContent>
  </Dialog>
 </TabsContent>
 </Tabs>
 </div>
 );
}
