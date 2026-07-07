
-- Restrict writes on user_roles: only admins may INSERT / UPDATE / DELETE.
-- Regular authenticated users retain SELECT (existing policy) but cannot
-- self-assign or escalate roles. The handle_new_user trigger runs as
-- SECURITY DEFINER and continues to seed the default 'user' role.

CREATE POLICY "Only admins can insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
