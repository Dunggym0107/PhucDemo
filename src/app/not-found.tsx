import Link from "next/link";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center select-none">
      <div className="max-w-md w-full space-y-8 animate-fade-in-up">
        {/* Visual Premium Accent */}
        <div className="w-20 h-20 bg-amber-50 border border-amber-100 rounded-3xl flex items-center justify-center mx-auto shadow-sm">
          <AlertCircle className="w-10 h-10 text-amber-600" />
        </div>

        <div className="space-y-3">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-normal">404</h1>
          <h2 className="text-lg font-bold text-slate-800">Không tìm thấy trang</h2>
          <p className="text-sm font-medium text-slate-500 max-w-sm mx-auto leading-relaxed">
            Đường dẫn bạn yêu cầu không tồn tại hoặc đã bị thay đổi trên hệ thống quản trị WorkFlow.
          </p>
        </div>

        <div>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center bg-slate-900 hover:bg-black text-white font-bold rounded-2xl min-h-12 px-5 text-[15px] shadow-md hover:shadow-lg active:scale-95 transition-all duration-200"
          >
            Quay lại Bảng điều khiển
          </Link>
        </div>
      </div>
    </div>
  );
}
