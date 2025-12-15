import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import SettingsLayout from "./SettingsLayout";
import FormField from "../../components/Forms/FormField";
import PasswordPolicyDisplay from "../../components/Forms/PasswordPolicyDisplay";
import { useModal } from "../../hooks/useModal";
import { getPasswordPolicy, validatePassword, createPasswordMaxLengthEnforcer } from "../../utils/passwordValidation";
import { apiPost } from "../../utils/api";

const NAV_BLUE = "#2563EB";

function ChangePasswordPage() {
  const navigate = useNavigate();
  const [current, setCurrent] = useState("");
  const [nextPw, setNextPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");

  const [showNotice, setShowNotice] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const timerRef = useRef(null);
  const { isOpen: isModalOpen, open, close } = useModal(false);

  // Use modal hook for success notice
  useEffect(() => {
    if (showNotice) {
      open();
    } else {
      close();
    }
  }, [showNotice, open, close]);

  const policy = useMemo(() => getPasswordPolicy(nextPw), [nextPw]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Enter") handleSubmit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const LOGIN_ROUTE = "/";

  // Start 5s countdown only after success modal shows
  useEffect(() => {
    if (!showNotice) return;
    setCountdown(5);
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timerRef.current);
          timerRef.current = null;
          navigate(LOGIN_ROUTE, { replace: true });
          return 0;
        }
        return c - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [showNotice, navigate]);

  const handleSubmit = async () => {
    if (!current && !nextPw && !confirmPw) {
      alert("The new password text box must have an entry put into it.");
      return;
    }
    if (!current || !nextPw || !confirmPw) {
      alert("Please fill in all required fields.");
      return;
    }
    if (nextPw !== confirmPw) {
      alert("The new password that was entered is different from the re-entry of the password.");
      return;
    }

    // Validate password using centralized validation
    const validation = validatePassword(nextPw);
    if (!validation.isValid) {
      alert(validation.errors[0] || "Password does not meet requirements.");
      return;
    }

    try {
      const data = await apiPost('auth/change_password.php', {
        currentPassword: current,
        newPassword: nextPw
      });

      if (data.success) {
        setShowNotice(true);
      } else {
        alert(data.error || "Unable to change password at this time.");
      }
    } catch (error) {
      alert(error.message || "Network error while changing password. Please try again.");
    }
  };

  return (
    <SettingsLayout>
      <div className="mb-6 flex items-center justify-between border-b border-slate-200 pb-3">
        <h1 className="text-2xl font-serif font-semibold" style={{ color: NAV_BLUE }}>
          Change Password
        </h1>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="rounded-lg border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50"
          style={{ color: NAV_BLUE }}
          aria-label="Go back"
        >
          ← Back
        </button>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <section>
          <FormField
            id="currentPassword"
            label="Current Password"
            type="password"
            value={current}
            onChange={createPasswordMaxLengthEnforcer(setCurrent)}
            placeholder="Enter current password"
            required
          />
          <FormField
            id="newPassword"
            label="New Password"
            type="password"
            value={nextPw}
            onChange={createPasswordMaxLengthEnforcer(setNextPw)}
            placeholder="Enter new password"
            required
          />
          <FormField
            id="confirmPassword"
            label="Re-enter New Password"
            type="password"
            value={confirmPw}
            onChange={createPasswordMaxLengthEnforcer(setConfirmPw)}
            placeholder="Re-enter new password"
            required
          />

          <button
            type="button"
            onClick={handleSubmit}
            className="mt-2 h-11 w-44 rounded-xl text-white shadow"
            style={{ backgroundColor: NAV_BLUE }}
          >
            Confirm
          </button>
        </section>

        <section className="rounded-lg border border-slate-200 dark:border-gray-700 p-4">
          <h2 className="mb-3 text-lg font-serif font-semibold" style={{ color: NAV_BLUE }}>
            Password must contain:
          </h2>
          <PasswordPolicyDisplay password={nextPw} />
        </section>
      </div>

      {/* Success Notice Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* backdrop */}
          <div className="absolute inset-0 bg-black bg-opacity-50" />
          {/* card */}
          <div
            className="relative z-10 w-full max-w-lg mx-4 rounded-xl shadow-2xl border border-white/10"
            style={{ backgroundColor: "#3d3eb5" }}
          >
            <div className="p-6">
              <h3 className="text-2xl font-serif text-white mb-3 text-center">Password Changed</h3>
              <p className="text-white/90 text-center leading-relaxed">
                Your password was changed successfully.
                <br />
                You will be taken to our log in page in{" "}
                <span className="font-semibold">{countdown}</span> seconds.
              </p>
            </div>
          </div>
        </div>
      )}
    </SettingsLayout>
  );
}

export default ChangePasswordPage;
