import { AuthProvider } from "@/features/auth/ui/provider";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
