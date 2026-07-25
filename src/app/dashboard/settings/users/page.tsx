'use client'

import React, { useState, useEffect } from "react";
import {
 Users,
 Search,
 Loader2,
 Shield,
 Building2,
 Save,
 Filter
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue
} from "@/components/ui/select";
import {
 Table,
 TableBody,
 TableCell,
 TableHead,
 TableHeader,
 TableRow
} from '@/components/ui/table'
import { createClient } from "@/utils/supabase/client";
import { notifyError, notifySuccess } from "@/lib/notify";
import { getProfileDisplayTitle, sortProfilesByHierarchy } from "@/lib/utils";
import { useSearchParams } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import { ListSkeleton } from "@/components/ui/list-skeleton";

export default function UserManagementPage() {
 const [users, setUsers] = useState<any[]>([]);
 const [departments, setDepartments] = useState<any[]>([]);
 const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get('q') || '';
 const [updatingId, setUpdatingId] = useState<string | null>(null);

 const supabase = createClient();

 useEffect(() => {
 fetchData();
 }, []);

 const fetchData = async () => {
 setLoading(true);
 try {
 const { data: profiles, error: pError } = await supabase
 .from('profiles')
 .select(`*, departments (id, name)`)
 .order('full_name');

 if (pError) throw pError;
  const sortedProfiles = sortProfilesByHierarchy(profiles || []);
 setUsers(sortedProfiles);

 const { data: depts, error: dError } = await supabase
 .from('departments')
 .select('*')
 .order('name');

 if (dError) throw dError;
 setDepartments(depts || []);

 } catch (error) {
 notifyError(error, "Không tải được dữ liệu");
 } finally {
 setLoading(false);
 }
 };

 const handleUpdateUser = async (userId: string, updates: any) => {
 setUpdatingId(userId);
 try {
 const { error } = await supabase
 .from('profiles')
 .update(updates)
 .eq('id', userId);

 if (error) throw error;

 setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...updates } : u));
 notifySuccess("Đã cập nhật thông tin người dùng");
 } catch (error) {
 notifyError(error, "Không cập nhật được người dùng");
 } finally {
 setUpdatingId(null);
 }
 };

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

 if (loading) return <div className="page-container py-10"><ListSkeleton variant="table" rows={6} /></div>;

 return (
 <div className="page-container space-y-10 motion-safe:animate-fade-in-up">
 <PageHeader
   title="Quản lý nhân sự"
   description="Cấu hình quyền hạn & phòng ban"
 />

 {/* User Table */}
 <div className="">
 <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
 <Table>
 <TableHeader className="bg-slate-50/50">
 <TableRow className="hover:bg-transparent border-slate-50">
 <TableHead className="w-[300px] text-label py-5 pl-8 truncate whitespace-nowrap">Cán bộ</TableHead>
 <TableHead className="text-label truncate whitespace-nowrap">Phòng ban</TableHead>
 <TableHead className="text-label truncate whitespace-nowrap">Quyền hệ thống</TableHead>
 <TableHead className="text-right pr-8"></TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {filteredUsers.map((user) => (
 <TableRow key={user.id} className="group hover:bg-slate-50/50 transition-all border-slate-50">
 <TableCell className="py-4 pl-8">
 <div className="flex items-center gap-4">
 <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
 <AvatarImage src={user.avatar_url} />
 <AvatarFallback className="bg-primary/5 text-primary text-sm font-medium">
 {user.full_name?.[0] ?? "?"}
 </AvatarFallback>
 </Avatar>
 <div className="flex flex-col">
 <span className="text-sm font-bold text-slate-900 group-hover:text-primary transition-colors">{user.full_name || "Chưa cập nhật tên"}</span>
 <span className="text-meta truncate whitespace-nowrap">{getProfileDisplayTitle(user)}</span>
 </div>
 </div>
 </TableCell>
 <TableCell>
 <Select
 value={user.department_id || "none"}
 onValueChange={(val) => handleUpdateUser(user.id, { department_id: val === "none" ? null : val })}
 disabled={updatingId === user.id}
 >
 <SelectTrigger className="w-[200px] bg-slate-50 border-none rounded-xl h-9 text-sm font-medium text-slate-600">
 <SelectValue />
 </SelectTrigger>
 <SelectContent className="rounded-xl border-none shadow-2xl">
 <SelectItem value="none">Chưa xác định</SelectItem>
 {departments.map((d) => (
 <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </TableCell>
 <TableCell>
 <Select
 value={user.role}
 onValueChange={(val) => handleUpdateUser(user.id, { role: val })}
 disabled={updatingId === user.id}
 >
 <SelectTrigger className="w-[180px] bg-slate-50 border-none rounded-xl h-9 text-sm font-medium text-slate-600">
 <SelectValue />
 </SelectTrigger>
 <SelectContent className="rounded-xl border-none shadow-2xl">
 <SelectItem value="staff">Cán bộ</SelectItem>
 <SelectItem value="manager">Lãnh đạo phòng</SelectItem>
 <SelectItem value="director">Ban giám đốc</SelectItem>
 <SelectItem value="admin">Quản trị hệ thống</SelectItem>
 </SelectContent>
 </Select>
 </TableCell>
 <TableCell className="text-right pr-8">
 <div className="flex items-center justify-end gap-2">
 {user.is_active === false ? (
 <Button
 size="sm"
 onClick={() => handleUpdateUser(user.id, { is_active: true })}
 disabled={updatingId === user.id}
 className="min-h-9 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
 >
 Kích hoạt
 </Button>
 ) : (
 <Badge className="status-success-bg px-2.5 py-1 text-xs font-semibold">
 Đã kích hoạt
 </Badge>
 )}
 {updatingId === user.id && <Loader2 className="w-4 h-4 animate-spin text-primary inline-block" />}
 </div>
 </TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 </div>
 </div>
 </div>
 );
}
