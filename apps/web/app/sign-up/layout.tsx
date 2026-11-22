import { AppClerkProvider } from "../(app)/AppClerkProvider";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AppClerkProvider>{children}</AppClerkProvider>;
}
