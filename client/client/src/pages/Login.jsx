import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import axiosInstance from "../services/axiosInstance";
import { useAuth } from "../services/authService";

export default function Login() {
  const { authUser, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || null;
  const selectedPlanId = location.state?.selectedPlanId || null;

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (authUser) {
      const role = authUser.role?.toLowerCase();
      const roleMap = {
        admin: "/adminpanel",
        trainer: "/trainerpanel",
        user: "/userpanel",
      };

      // If we came from membership plans with a selected plan, redirect back there
      if (from === "/membership-plans" && selectedPlanId) {
        navigate(from, {
          replace: true,
          state: { selectedPlanId },
        });
      } else {
        navigate(roleMap[role] || "/", { replace: true });
      }
    }
  }, [authUser, navigate, from, selectedPlanId]);

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await axiosInstance.post("/api/users/login", formData);

      const { user, token } = res.data;

      if (!token) {
        console.error("❌ No token in response");
        toast.error("Login failed: No token received");
        return;
      }

      login(user, token);

      toast.success("Login successful!");

      // If we came from membership plans with a selected plan, redirect back there
      if (from === "/membership-plans" && selectedPlanId) {
        navigate(from, {
          replace: true,
          state: { selectedPlanId },
        });
      } else {
        const role = user.role?.toLowerCase();

        navigate(
          {
            admin: "/adminpanel",
            trainer: "/trainerpanel",
            user: "/userpanel",
          }[role] || "/"
        );
      }
    } catch (err) {
      console.error("❌ Login error:", err);
      console.error("Error response:", err.response);
      toast.error(err.response?.data?.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex justify-center py-5 px-4 bg-[#141414] h-screen">
      <div className="flex flex-col w-full max-w-xl py-5">
        <h2 className="text-white md:px-48 text-[28px] font-bold leading-tight px-[190px] pt-5 pb-3">
          Login
        </h2>

        <form onSubmit={handleSubmit}>
          {/* Email */}
          <div className="flex flex-wrap items-end gap-4 px-4 py-3 max-w-md">
            <label className="flex flex-col flex-1 min-w-40">
              <p className="text-white pb-2">Email</p>
              <input
                required
                type="email"
                name="email"
                placeholder="Enter your email"
                value={formData.email}
                onChange={handleChange}
                className="w-full h-14 p-4 rounded-lg bg-[#363636] text-white placeholder-[#adadad]"
              />
            </label>
          </div>

          {/* Password */}
          <div className="flex flex-wrap items-end gap-4 px-4 py-3 max-w-md">
            <label className="flex flex-col flex-1 min-w-40">
              <p className="text-white pb-2">Password</p>
              <input
                required
                type="password"
                name="password"
                placeholder="Enter your password"
                value={formData.password}
                onChange={handleChange}
                className="w-full h-14 p-4 rounded-lg bg-[#363636] text-white placeholder-[#adadad]"
              />
            </label>
          </div>

          {/* Forgot Password */}
          <p
            onClick={() => navigate("/forgetpassword")}
            className="text-[#adadad] text-sm font-normal leading-normal px-4 pt-1 pb-3 underline cursor-pointer"
          >
            Forgot password?
          </p>

          <div className="flex px-4 py-3 max-w-md">
            <button
              type="submit"
              disabled={submitting}
              className="w-full h-12 rounded-lg bg-black text-white disabled:opacity-60"
            >
              {submitting ? "Logging in..." : "Login"}
            </button>
          </div>

          {/* Register Link */}
          <p className="text-[#adadad] text-sm font-normal leading-normal px-[110px] md:px-36 pt-1 pb-3">
            Don't have an account?{" "}
            <span
              onClick={() => navigate("/register")}
              className="text-white underline cursor-pointer"
            >
              Register
            </span>
          </p>
        </form>
      </div>
    </div>
  );
}
