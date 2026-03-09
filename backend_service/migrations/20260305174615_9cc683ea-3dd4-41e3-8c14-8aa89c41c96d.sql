
-- Create update timestamp function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Doctors table
CREATE TABLE public.doctors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  specialty TEXT NOT NULL,
  language_support TEXT[] NOT NULL DEFAULT ARRAY['en'],
  hospital TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Doctors are viewable by everyone" ON public.doctors FOR SELECT USING (true);

-- Doctor availability slots
CREATE TABLE public.doctor_slots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  slot_date DATE NOT NULL,
  slot_time TIME NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(doctor_id, slot_date, slot_time)
);

ALTER TABLE public.doctor_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Slots are viewable by everyone" ON public.doctor_slots FOR SELECT USING (true);
CREATE POLICY "Slots can be updated by anyone" ON public.doctor_slots FOR UPDATE USING (true);

-- Patients table
CREATE TABLE public.patients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  preferred_language TEXT DEFAULT 'en',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Patients viewable by everyone" ON public.patients FOR SELECT USING (true);
CREATE POLICY "Patients insertable by anyone" ON public.patients FOR INSERT WITH CHECK (true);
CREATE POLICY "Patients updatable by anyone" ON public.patients FOR UPDATE USING (true);

CREATE TRIGGER update_patients_updated_at
  BEFORE UPDATE ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Appointments table
CREATE TABLE public.appointments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  slot_id UUID REFERENCES public.doctor_slots(id),
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'rescheduled', 'completed')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Appointments viewable by everyone" ON public.appointments FOR SELECT USING (true);
CREATE POLICY "Appointments insertable by anyone" ON public.appointments FOR INSERT WITH CHECK (true);
CREATE POLICY "Appointments updatable by anyone" ON public.appointments FOR UPDATE USING (true);
CREATE POLICY "Appointments deletable by anyone" ON public.appointments FOR DELETE USING (true);

CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Conversation memory table
CREATE TABLE public.conversation_memory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  language TEXT DEFAULT 'en',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.conversation_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Memory viewable by everyone" ON public.conversation_memory FOR SELECT USING (true);
CREATE POLICY "Memory insertable by anyone" ON public.conversation_memory FOR INSERT WITH CHECK (true);

-- Latency logs table
CREATE TABLE public.latency_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  stage TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.latency_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Latency logs viewable by everyone" ON public.latency_logs FOR SELECT USING (true);
CREATE POLICY "Latency logs insertable by anyone" ON public.latency_logs FOR INSERT WITH CHECK (true);

-- Outbound campaigns table
CREATE TABLE public.outbound_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  campaign_type TEXT NOT NULL CHECK (campaign_type IN ('reminder', 'follow_up', 'vaccination')),
  message TEXT NOT NULL,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.outbound_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Campaigns viewable by everyone" ON public.outbound_campaigns FOR SELECT USING (true);
CREATE POLICY "Campaigns insertable by anyone" ON public.outbound_campaigns FOR INSERT WITH CHECK (true);
CREATE POLICY "Campaigns updatable by anyone" ON public.outbound_campaigns FOR UPDATE USING (true);

-- Seed doctor data
INSERT INTO public.doctors (name, specialty, language_support, hospital) VALUES
  ('Dr. Sharma', 'Cardiologist', ARRAY['en', 'hi'], 'Apollo Hospital'),
  ('Dr. Priya', 'Dermatologist', ARRAY['en', 'hi', 'ta'], 'Fortis Hospital'),
  ('Dr. Ramesh', 'General Physician', ARRAY['en', 'ta'], 'AIIMS'),
  ('Dr. Gupta', 'Orthopedic', ARRAY['en', 'hi'], 'Max Hospital'),
  ('Dr. Lakshmi', 'Pediatrician', ARRAY['en', 'hi', 'ta'], 'Apollo Hospital');

-- Seed available slots for next 7 days
INSERT INTO public.doctor_slots (doctor_id, slot_date, slot_time)
SELECT d.id, (CURRENT_DATE + i)::DATE, t::TIME
FROM public.doctors d,
     generate_series(1, 7) AS i,
     unnest(ARRAY['09:00', '09:30', '10:00', '10:30', '11:00', '14:00', '14:30', '15:00', '15:30', '16:00']::TIME[]) AS t;

-- Seed a test patient
INSERT INTO public.patients (name, phone, preferred_language) VALUES
  ('Test Patient', '+91-9876543210', 'en');
