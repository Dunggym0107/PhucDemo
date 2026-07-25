"use client"

import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"

import { cn } from "@/lib/utils"

const Avatar = React.forwardRef<
 React.ElementRef<typeof AvatarPrimitive.Root>,
 React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
 <AvatarPrimitive.Root
 ref={ref}
 className={cn(
 "relative flex h-11 w-11 shrink-0 overflow-hidden rounded-full",
 className
 )}
 {...props}
 />
))
Avatar.displayName = AvatarPrimitive.Root.displayName

// Supabase Image Transformation (`/render/image/public/`) chỉ có trên Pro plan.
// Free plan trả 403 FeatureNotEnabled — kích hoạt khi flag bật + dự án có Pro.
// Default tắt: serve URL gốc `/object/public/`. Resize đã được handle phía upload
// (avatar crop dialog → 384px JPEG ~100KB) nên không cần CDN transform.
const IMAGE_TRANSFORM_ENABLED = process.env.NEXT_PUBLIC_SUPABASE_IMAGE_TRANSFORM === 'true';

function transformAvatarUrl(url?: string, size: number = 128): string | undefined {
 if (!url) return url;
 if (!IMAGE_TRANSFORM_ENABLED) return url;
 if (!url.includes('/storage/v1/object/public/avatars/')) return url;
 const transformed = url.replace('/object/public/', '/render/image/public/');
 const [base, existingQuery] = transformed.split('?');
 const params = new URLSearchParams(existingQuery ?? '');
 params.set('width', String(size));
 params.set('height', String(size));
 params.set('resize', 'cover');
 params.set('quality', '80');
 return `${base}?${params.toString()}`;
}

type AvatarImageProps = React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image> & {
 size?: number;
};

const AvatarImage = React.forwardRef<
 React.ElementRef<typeof AvatarPrimitive.Image>,
 AvatarImageProps
>(({ className, src, size = 128, ...props }, ref) => (
 <AvatarPrimitive.Image
 ref={ref}
 src={transformAvatarUrl(typeof src === 'string' ? src : undefined, size)}
 className={cn("aspect-square h-full w-full object-cover", className)}
 {...props}
 />
))
AvatarImage.displayName = AvatarPrimitive.Image.displayName

const AvatarFallback = React.forwardRef<
 React.ElementRef<typeof AvatarPrimitive.Fallback>,
 React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
 <AvatarPrimitive.Fallback
 ref={ref}
 className={cn(
 "flex h-full w-full items-center justify-center rounded-full bg-muted",
 className
 )}
 {...props}
 />
))
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName

export { Avatar, AvatarImage, AvatarFallback }
