// Chỉ 1 nơi import locale tiếng Việt cho date-fns
// Tránh duplicate bundle khi nhiều file cùng import "date-fns/locale"
import { vi } from "date-fns/locale";
export { vi as viLocale };
