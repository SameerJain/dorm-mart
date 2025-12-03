import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import SettingsLayout from "./SettingsLayout";

const NAV_BLUE = "#2563EB";
const MAX_LEN = 64;

const hasLower = (s) => /[a-z]/.test(s);
const hasUpper = (s) => /[A-Z]/.test(s);
const hasDigit = (s) => /\d/.test(s);
const hasSpecial = (s) => /[^A-Za-z0-9]/.test(s);

function RequirementRow({ ok, text }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="inline-flex h-2.5 w-2.5 rounded-full" style={{ backgroundColor: ok ? "#22c55e" : "#ef4444" }} />
      <span className={ok ? "text-green-700" : "text-red-700"}>{text}</span>
    </div>
  );
}

function Field({ id, label, type = "password", value, onChange, placeholder }) {
  return (
    <div className="mb-6">
      <label htmlFor={id} className="mb-2 block text-base font-medium text-slate-700">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={onChange}
        className="h-11 w-full rounded-xl border border-slate-300 bg-slate-100 px-4 text-slate-900 outline-none focus:bg-white focus:ring-2"
        style={{ focusRingColor: NAV_BLUE }}
      />
    </div>
  );
}

async function safeError(res) {
  try {
    const data = await res.json();
    return data?.error || data?.message;
  } catch {
    return null;
  }
}

function ChangePasswordPage() {
  const navigate = useNavigate();
  const [current, setCurrent] = useState("");
  const [nextPw, setNextPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");

  const [showNotice, setShowNotice] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const timerRef = useRef(null);

  // Prevent body scroll when success modal is open
  useEffect(() => {
    if (showNotice) {
      const scrollY = window.scrollY;
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
    } else {
      const scrollY = document.body.style.top;
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || '0') * -1);
      }
    }
    return () => {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
    };
  }, [showNotice]);

  const policy = useMemo(
    () => ({
      minLen: nextPw.length >= 8,
      lower: hasLower(nextPw),
      upper: hasUpper(nextPw),
      digit: hasDigit(nextPw),
      special: hasSpecial(nextPw),
      notTooLong: nextPw.length <= MAX_LEN,
    }),
    [nextPw]
  );

  const enforceMax = (setter) => (e) => {
    const v = e.target.value;
    if (v.length > MAX_LEN) alert("Entered password is too long. Maximum length is 64 characters.");
    setter(v);
  };

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
    if (current.length > MAX_LEN || nextPw.length > MAX_LEN || confirmPw.length > MAX_LEN) {
      alert("Entered password is too long. Maximum length is 64 characters.");
      return;
    }
    if (nextPw.length < 8) {
      alert("The new password must have at least 8 characters.");
      return;
    }
    if (!hasLower(nextPw)) {
      alert("The new password must have at least 1 lowercase letter.");
      return;
    }
    if (!hasUpper(nextPw)) {
      alert("The new password must have at least 1 uppercase letter.");
      return;
    }
    if (!hasDigit(nextPw)) {
      alert("The new password must have at least 1 digit.");
      return;
    }
    if (!hasSpecial(nextPw)) {
      alert("The new password must have at least 1 special character.");
      return;
    }

    try {
      const res = await fetch("api/auth/change_password.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword: current, newPassword: nextPw }),
      });

      if (res.ok) {
        setShowNotice(true);
      } else {
        const msg = await safeError(res);
        alert(msg || "Unable to change password at this time.");
      }
    } catch {
      alert("Network error while changing password. Please try again.");
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
          <Field
            id="currentPassword"
            label="Current Password"
            value={current}
            onChange={enforceMax(setCurrent)}
            placeholder="Enter current password"
          />
          <Field
            id="newPassword"
            label="New Password"
            value={nextPw}
            onChange={enforceMax(setNextPw)}
            placeholder="Enter new password"
          />
          <Field
            id="confirmPassword"
            label="Re-enter New Password"
            value={confirmPw}
            onChange={enforceMax(setConfirmPw)}
            placeholder="Re-enter new password"
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

        <section className="rounded-lg border border-slate-200 p-4">
          <h2 className="mb-3 text-lg font-serif font-semibold" style={{ color: NAV_BLUE }}>
            Password must contain:
          </h2>
          <div className="flex flex-col gap-2">
            <RequirementRow ok={policy.lower} text="At least 1 lowercase character" />
            <RequirementRow ok={policy.upper} text="At least 1 uppercase character" />
            <RequirementRow ok={policy.minLen} text="At least 8 characters" />
            <RequirementRow ok={policy.special} text="At least 1 special character" />
            <RequirementRow ok={policy.digit} text="At least 1 digit" />
            <RequirementRow ok={policy.notTooLong} text="No more than 64 characters" />
          </div>
        </section>
      </div>

      {/* Success Notice Modal */}
      {showNotice && (
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
