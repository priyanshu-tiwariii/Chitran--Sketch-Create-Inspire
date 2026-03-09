import { signIn, useSession } from "next-auth/react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@repo/ui/components/ui/dialog";
import { FcGoogle } from "react-icons/fc"; 
import { FaGithub } from "react-icons/fa"; 
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

const LoginButton = ({ className, name, ...props }: { className?: string; name: ReactNode } & React.ComponentPropsWithoutRef<'button'>) => {
  const { data: session } = useSession();
  const router = useRouter();
  useEffect(() => {
    if (session) {
      router.push("/dashboard");
    }
  }, [session, router]);

  if (session) return null;

  return(
    <Dialog>
      <DialogTrigger asChild>
        <button
          className={`bg-gradient-to-r from-[#ff9966] to-[#ff5e62] cursor-pointer ${className ?? ""}`}
          {...props}
        >
          {name}
        </button>
      </DialogTrigger>
      <DialogContent
        className="bg-white border border-gray-200 shadow-xl rounded-2xl p-8 text-gray-900 max-w-sm mx-auto"
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-center">Welcome to Chitran</DialogTitle>
          <DialogDescription className="text-sm text-gray-500 text-center mt-1">
            Sign in to start collaborating on your canvas
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col space-y-3 mt-6">
          {/* Google Sign-in Button */}
          <button
            onClick={() => signIn("google")}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700 shadow-sm cursor-pointer"
          >
            <FcGoogle className="text-xl flex-shrink-0" />
            <span>Continue with Google</span>
          </button>

          {/* GitHub Sign-in Button */}
          <button
            onClick={() => signIn("github")}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-gray-900 hover:bg-gray-800 transition-colors text-sm font-medium text-white shadow-sm cursor-pointer"
          >
            <FaGithub className="text-xl flex-shrink-0" />
            <span>Continue with GitHub</span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LoginButton;
