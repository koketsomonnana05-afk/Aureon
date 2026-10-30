import { GoogleAuthProvider, signInWithPopup, linkWithPopup, onAuthStateChanged, User } from "firebase/auth";
import { auth } from "./firebase";

export const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
];

// In-memory token cache (strictly adhering to memory-only token guideline)
let cachedAccessToken: string | null = null;

export const getCalendarAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const setCalendarAccessToken = (token: string | null) => {
  cachedAccessToken = token;
};

export const createGoogleProvider = (): GoogleAuthProvider => {
  const provider = new GoogleAuthProvider();
  GOOGLE_CALENDAR_SCOPES.forEach((scope) => provider.addScope(scope));
  provider.setCustomParameters({
    prompt: "consent",
    access_type: "online",
  });
  return provider;
};

// Clear memory cache when user logs out
onAuthStateChanged(auth, (user: User | null) => {
  if (!user) {
    cachedAccessToken = null;
  }
});

export const connectGoogleCalendar = async (): Promise<{ user: User; accessToken: string }> => {
  const provider = createGoogleProvider();
  let result;
  
  if (auth.currentUser) {
    try {
      result = await linkWithPopup(auth.currentUser, provider);
    } catch (linkError: any) {
      // If already linked or account exists, sign in directly with popup
      if (
        linkError.code === "auth/credential-already-in-use" ||
        linkError.code === "auth/provider-already-linked" ||
        linkError.code === "auth/email-already-in-use"
      ) {
        result = await signInWithPopup(auth, provider);
      } else {
        throw linkError;
      }
    }
  } else {
    result = await signInWithPopup(auth, provider);
  }

  const credential = GoogleAuthProvider.credentialFromResult(result);
  if (!credential?.accessToken) {
    throw new Error("Could not retrieve access token from Google");
  }

  cachedAccessToken = credential.accessToken;
  return { user: result.user, accessToken: cachedAccessToken };
};

export const disconnectGoogleCalendar = () => {
  cachedAccessToken = null;
};

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
  htmlLink?: string;
  colorId?: string;
}

export const fetchCalendarEvents = async (
  timeMin: Date,
  timeMax: Date
): Promise<GoogleCalendarEvent[]> => {
  if (!cachedAccessToken) {
    throw new Error("NOT_AUTHENTICATED");
  }

  const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
  url.searchParams.set("timeMin", timeMin.toISOString());
  url.searchParams.set("timeMax", timeMax.toISOString());
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${cachedAccessToken}`,
    },
  });

  if (response.status === 401) {
    cachedAccessToken = null;
    throw new Error("TOKEN_EXPIRED");
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Failed to fetch events: ${response.statusText}`);
  }

  const data = await response.json();
  return (data.items || []) as GoogleCalendarEvent[];
};

export const insertCalendarEvent = async (event: {
  summary: string;
  description?: string;
  startDateTime: string;
  endDateTime: string;
}): Promise<GoogleCalendarEvent> => {
  if (!cachedAccessToken) {
    throw new Error("NOT_AUTHENTICATED");
  }

  const body = {
    summary: event.summary,
    description: event.description || "Created with Aureon LifeOS",
    start: {
      dateTime: event.startDateTime,
    },
    end: {
      dateTime: event.endDateTime,
    },
  };

  const response = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cachedAccessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (response.status === 401) {
    cachedAccessToken = null;
    throw new Error("TOKEN_EXPIRED");
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || "Failed to create Google Calendar event");
  }

  return (await response.json()) as GoogleCalendarEvent;
};

export const deleteCalendarEvent = async (eventId: string): Promise<void> => {
  if (!cachedAccessToken) {
    throw new Error("NOT_AUTHENTICATED");
  }

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${cachedAccessToken}`,
      },
    }
  );

  if (response.status === 401) {
    cachedAccessToken = null;
    throw new Error("TOKEN_EXPIRED");
  }

  if (!response.ok && response.status !== 404) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || "Failed to delete Google Calendar event");
  }
};
