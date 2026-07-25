import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { sortProfilesByHierarchy } from "@/lib/utils";
import { notifyError, notifySuccess, notifyValidation } from "@/lib/notify";
import { useAppData } from "@/hooks/use-app-data";

export function useAdmin() {
 const router = useRouter();
 const supabase = createClient();
 // Profile/vệ sinh trích từ provider — và vehicles/rooms dùng chung TTL 24h
 const { currentProfile, vehicles: cachedVehicles, rooms: cachedRooms, refresh: refreshAppData } = useAppData();

 const [loading, setLoading] = useState(true);
 const [userProfile, setUserProfile] = useState<any>(null);
 const [users, setUsers] = useState<any[]>([]);
 // Vẫn giữ state local để sync với từng action create/update/delete cho UX mượt,
 // nhưng KHÔNG fetch riêng từ DB nữa — nguồn ban đầu từ provider.
 const [rooms, setRooms] = useState<any[]>([]);
 const [vehicles, setVehicles] = useState<any[]>([]);
 const [stats, setStats] = useState({ tasks: 0, goals: 0, members: 0 });
 const [searchQuery, setSearchQuery] = useState("");
 const [drivers, setDrivers] = useState<any[]>([]);

 // State cho tạo mới
 const [newRoom, setNewRoom] = useState({ name: "", capacity: 10, location: "" });
 const [newVehicle, setNewVehicle] = useState({ name: "", plate_number: "", type: "4 chỗ", driver_id: "none" });
 const [isRoomOpen, setIsRoomOpen] = useState(false);
 const [isVehicleOpen, setIsVehicleOpen] = useState(false);

 const [editingRoom, setEditingRoom] = useState<any>(null);
 const [isEditRoomOpen, setIsEditRoomOpen] = useState(false);
 const [editingVehicle, setEditingVehicle] = useState<any>(null);
 const [isEditVehicleOpen, setIsEditVehicleOpen] = useState(false);


 useEffect(() => {
 const initAdmin = async () => {
 setLoading(true);
 try {
 if (!currentProfile) {
 // Provider chưa hydrate xong — đợi lượt render tiếp theo
 return;
 }

 setUserProfile(currentProfile);

 // Chỉ ADMIN hoặc SECRETARY mới được vào trang này
 if (currentProfile.role !== 'admin' && currentProfile.role !== 'secretary') {
 notifyError(null, "Khu vực này chỉ dành cho Quản trị viên và Lễ tân.");
 router.push('/dashboard/schedule');
 return;
 }

 await fetchData();
 } catch (error) {
 console.error(error);
 } finally {
 setLoading(false);
 }
 };

 initAdmin();
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [currentProfile?.id]);

 const fetchData = async () => {
 try {
 // Admin cần thấy CẢ inactive (để có thể kích hoạt lại) → vẫn fetch riêng,
 // không dùng useAppData (filter is_active=true).
 const { count: memberCount } = await supabase.from('profiles').select('*', { count: 'estimated', head: true });
 const { data: userList } = await supabase.from('profiles').select('*, departments (name)').order('full_name');
 // Drivers cho dropdown — derive từ userList (đã có), khỏi fetch lại
 const driverList = (userList || []).filter((u: any) => u.role === 'driver').map((u: any) => ({
   id: u.id, full_name: u.full_name, phone: u.phone
 }));

 setStats({ tasks: 0, goals: 0, members: memberCount || 0 });
 setUsers(sortProfilesByHierarchy(userList || []));
 // Rooms / vehicles lấy từ AppDataProvider (TTL 24h, realtime invalidate),
 // không fetch thêm round-trip nào.
 setRooms(cachedRooms || []);
 setVehicles(cachedVehicles || []);
 setDrivers(driverList);
 } catch (error) {
 notifyError(error, "Không tải được dữ liệu quản trị");
 }
 };

 // Khi rooms/vehicles trong provider thay đổi (do realtime hoặc provider refresh),
 // đồng bộ vào state local để UI nhảy kịp.
 useEffect(() => { setRooms(cachedRooms || []); }, [cachedRooms]);
 useEffect(() => { setVehicles(cachedVehicles || []); }, [cachedVehicles]);

 const handleUpdateRole = async (userId: string, newRole: any) => {
 try {
 const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
 if (error) throw error;
 setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
 notifySuccess("Đã cập nhật quyền hạn cán bộ");
 } catch (error) {
 notifyError(error, "Không cập nhật được quyền");
 }
 };

 const handleCreateRoom = async () => {
 try {
 const { data, error } = await supabase.from('rooms').insert([newRoom]).select();
 if (error) throw error;
 setRooms([...rooms, data[0]]);
 setIsRoomOpen(false);
 setNewRoom({ name: "", capacity: 10, location: "" });
 notifySuccess("Đã thêm phòng họp mới");
 } catch (error) {
 notifyError(error, "Không thêm được phòng họp");
 }
 };

 // Phân biệt lỗi biển số trùng để đưa ra thông báo cụ thể
 const isDuplicatePlateError = (err: any): boolean => {
   return err?.code === '23505'
     || err?.code === '409'
     || err?.status === 409
     || err?.message?.includes('vehicles_plate_number_key')
     || err?.message?.toLowerCase().includes('duplicate');
 };

 const handleCreateVehicle = async () => {
 try {
 const { data, error } = await supabase.from('vehicles').insert([{
   name: newVehicle.name, plate_number: newVehicle.plate_number, type: newVehicle.type, driver_id: newVehicle.driver_id === "none" ? null : newVehicle.driver_id
 }]).select('*, driver:profiles!vehicles_driver_id_fkey(id, full_name, phone)');
 if (error) throw error;
 setVehicles([...vehicles, data[0]]);
 setIsVehicleOpen(false);
 setNewVehicle({ name: "", plate_number: "", type: "4 chỗ", driver_id: "none" });
 notifySuccess("Đã thêm xe mới");
 } catch (error: any) {
 if (isDuplicatePlateError(error)) {
   notifyValidation("Biển số xe này đã tồn tại trong hệ thống.", "Biển số trùng lặp");
 } else {
   notifyError(error, "Không thêm được xe");
 }
 }
 };

 const handleUpdateRoom = async () => {
  try {
   const { error } = await supabase.from('rooms').update({
    name: editingRoom.name,
    capacity: editingRoom.capacity,
    location: editingRoom.location
   }).eq('id', editingRoom.id);
   if (error) throw error;
   setRooms(rooms.map(r => r.id === editingRoom.id ? editingRoom : r));
   setIsEditRoomOpen(false);
   setEditingRoom(null);
   notifySuccess("Đã cập nhật phòng họp");
  } catch (error) {
   notifyError(error, "Không cập nhật được phòng họp");
  }
 };

 const handleUpdateVehicle = async () => {
  try {
   const { data, error } = await supabase.from('vehicles').update({
    name: editingVehicle.name,
    plate_number: editingVehicle.plate_number,
    type: editingVehicle.type,
    driver_id: editingVehicle.driver_id === "none" ? null : editingVehicle.driver_id
   }).eq('id', editingVehicle.id).select('*, driver:profiles!vehicles_driver_id_fkey(id, full_name, phone)');
   if (error) throw error;
   setVehicles(vehicles.map(v => v.id === editingVehicle.id ? data[0] : v));
   setIsEditVehicleOpen(false);
   setEditingVehicle(null);
   notifySuccess("Đã cập nhật thông tin xe");
  } catch (error: any) {
   if (isDuplicatePlateError(error)) {
     notifyValidation("Biển số xe này đã tồn tại trong hệ thống.", "Biển số trùng lặp");
   } else {
     notifyError(error, "Không cập nhật được xe");
   }
  }
 };

 const handleDeleteRoom = async (room: any) => {
 try {
 // Kiểm tra lịch tương lai + lịch quá khứ chưa hoàn tất (in_progress qua đêm)
 const nowIso = new Date().toISOString();
 const [futureRes, inProgressRes] = await Promise.all([
   supabase.from('schedules').select('id', { count: 'exact', head: true }).eq('room_id', room.id).gte('start_time', nowIso),
   supabase.from('schedules').select('id', { count: 'exact', head: true }).eq('room_id', room.id).eq('status', 'in_progress')
 ]);
 if (futureRes.error) throw futureRes.error;
 if (inProgressRes.error) throw inProgressRes.error;

 const futureCount = futureRes.count || 0;
 const inProgressCount = inProgressRes.count || 0;
 if (futureCount > 0 || inProgressCount > 0) {
   const detail = inProgressCount > 0
     ? `có ${inProgressCount} lịch đang diễn ra`
     : `đang có ${futureCount} lịch trình trong tương lai`;
   notifyValidation(
     `Phòng "${room.name}" ${detail}. Vui lòng huỷ hoặc kết thúc các lịch trước khi xoá.`,
     "Không thể xoá phòng"
   );
   return;
 }

 const { error } = await supabase.from('rooms').delete().eq('id', room.id);
 if (error) throw error;

 setRooms(rooms.filter(r => r.id !== room.id));
 notifySuccess(`Đã xoá phòng "${room.name}"`);
 } catch (error) {
 notifyError(error, "Không xoá được phòng họp");
 }
 };

 const handleDeleteVehicle = async (vehicle: any) => {
 try {
 const nowIso = new Date().toISOString();
 const [futureRes, inProgressRes] = await Promise.all([
   supabase.from('schedules').select('id', { count: 'exact', head: true }).eq('vehicle_id', vehicle.id).gte('start_time', nowIso),
   supabase.from('schedules').select('id', { count: 'exact', head: true }).eq('vehicle_id', vehicle.id).eq('status', 'in_progress')
 ]);
 if (futureRes.error) throw futureRes.error;
 if (inProgressRes.error) throw inProgressRes.error;

 const futureCount = futureRes.count || 0;
 const inProgressCount = inProgressRes.count || 0;
 if (futureCount > 0 || inProgressCount > 0) {
   const detail = inProgressCount > 0
     ? `đang được sử dụng cho chuyến đang diễn ra`
     : `có ${futureCount} lịch trình trong tương lai`;
   notifyValidation(
     `Xe "${vehicle.plate_number}" ${detail}. Vui lòng huỷ gán xe hoặc kết thúc chuyến trước khi xoá.`,
     "Không thể xoá xe"
   );
   return;
 }

 const { error } = await supabase.from('vehicles').delete().eq('id', vehicle.id);
 if (error) throw error;

 setVehicles(vehicles.filter(v => v.id !== vehicle.id));
 notifySuccess(`Đã xoá xe "${vehicle.plate_number}"`);
 } catch (error) {
 notifyError(error, "Không xoá được xe");
 }
 };

  return {
    loading, userProfile, users, rooms, vehicles, stats, searchQuery, setSearchQuery, drivers,
    newRoom, setNewRoom, isRoomOpen, setIsRoomOpen, newVehicle, setNewVehicle, isVehicleOpen, setIsVehicleOpen,
    editingRoom, setEditingRoom, isEditRoomOpen, setIsEditRoomOpen, editingVehicle, setEditingVehicle, isEditVehicleOpen, setIsEditVehicleOpen,
    handleUpdateRole, handleCreateRoom, handleCreateVehicle, handleUpdateRoom, handleUpdateVehicle, handleDeleteRoom, handleDeleteVehicle, fetchData
  };
}
