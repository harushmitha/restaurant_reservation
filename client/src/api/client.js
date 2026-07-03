import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5001/api",
});

// Attach the JWT (kept in localStorage) to every request.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401 (expired/invalid token) clear the session so the UI redirects to login.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("token");
    }
    return Promise.reject(err);
  }
);

/** Extract a human-friendly message from an Axios error, preferring field errors. */
export function apiErrorMessage(err) {
  const data = err.response?.data;
  if (data?.errors?.length) {
    return data.errors.map((e) => e.message).join(", ");
  }
  return data?.message || err.message || "Something went wrong";
}

/* ------------------------------ Endpoints ------------------------------ */
export const authApi = {
  register: (payload) => api.post("/auth/register", payload),
  login: (payload) => api.post("/auth/login", payload),
  me: () => api.get("/auth/me"),
};

export const tableApi = {
  list: () => api.get("/tables"),
  create: (payload) => api.post("/tables", payload),
  update: (id, payload) => api.put(`/tables/${id}`, payload),
  deactivate: (id) => api.delete(`/tables/${id}`),
};

export const reservationApi = {
  availability: (params) => api.get("/reservations/availability", { params }),
  create: (payload) => api.post("/reservations", payload),
  mine: () => api.get("/reservations/my"),
  cancel: (id) => api.patch(`/reservations/${id}/cancel`),
  listAll: (params) => api.get("/reservations", { params }),
  update: (id, payload) => api.patch(`/reservations/${id}`, payload),
};

export default api;
