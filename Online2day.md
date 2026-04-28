## **Recommended build**

Use **Next.js \+ Supabase \+ Resend/React Email \+ Supabase Storage**.

### **1\. Lead dashboard**

Create a private `/dashboard` route.

Track each lead with stages:

`New → Contacted → Video Sent → Follow-up Due → Proposal Sent → Won/Lost`

**Suggested Supabase tables:**

**leads**

\- id

\- name

\- company

\- email

\- phone

\- source

\- status

\- assigned\_to

\- notes

\- created\_at

\- updated\_at

**lead\_events**

\- id

\- lead\_id

\- type

\- note

\- created\_by

\- created\_at

**lead\_assets**

\- id

\- lead\_id

\- type \-- video, email\_image, proposal, attachment

\- storage\_path

\- public\_url

\- created\_at

**Use Supabase Auth \+ Row Level Security so only your team can access the dashboard. Supabase specifically recommends enabling RLS because exposed tables without RLS can otherwise be accessed by roles with API grants.**

### **2\. Email generation**

Do **not** generate emails only as images. Images can be blocked by Gmail/Outlook and are bad for accessibility/spam scoring.

Better:

Use **React Email** to generate clean HTML emails, then optionally include a branded image/banner inside the email. React Email is designed for responsive email templates and handles email-client inconsistencies.

Use **Resend** to send the emails from your domain, e.g.

`hello@online2day.com`

**Email types:**

Initial outreach  
Video follow-up  
Proposal sent  
Chase-up 1  
Chase-up 2  
Won/lost confirmation

### **3\. Video email workflow**

Best approach:

Upload the personalised video to **Supabase Storage** or your own hosted media route.

Then send a lightweight email containing:

Hi \[Name\],

I recorded a short personalised video for \[Company\].

Watch it here:

\[Button: Watch Video\]

Regards,

Online2Day

**The button links to:**

[**online2day.com/v/\[lead-video-slug**](http://online2day.com/v/[lead-video-slug)**\]**

**This avoids heavy email attachments and lets you track clicks/views.**

**The hosted page should include:**

\- Embedded video

\- Client name/company

\- CTA: Book a call

\- CTA: Reply by email

\- Optional proposal/download

Use signed URLs for private videos, or public URLs for simple marketing videos. Supabase Storage supports this kind of hosted asset flow.

### **4\. Tracking**

**Track:**

Email generated

Email sent

Email opened, if provider supports it

Video link clicked

Video page viewed

Proposal viewed

Follow-up due date

Deal status

Add a `lead_events` row every time something happens.

**Example:**

2026-04-28 — Video email sent

2026-04-29 — Client viewed video page

2026-04-30 — Follow-up due

### **5\. Next.js implementation**

Use **Server Actions** for secure mutations such as updating lead status, adding notes, uploading assets, and sending emails. Next.js Server Actions run on the server and are intended for form submissions/data mutations. 

**Recommended routes:**

/dashboard

/dashboard/leads

/dashboard/leads/\[id\]

/dashboard/emails

/v/\[slug\]

/api/track/view

/api/track/click

Build this as a **mini CRM inside online2day.com**, not as a separate tool. Keep emails lightweight, host videos on the site, and log every action into Supabase so the dashboard becomes the single source of truth.

