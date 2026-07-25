import { redirect } from 'next/navigation';

export default function RootPage() {
 // Tự động điều hướng về trang Login duy nhất của hệ thống
 redirect('/login');
}
