DO $$
DECLARE actor_id uuid; equipment uuid; denied boolean;
BEGIN
 SELECT u.id INTO actor_id FROM public.users u JOIN public.app_roles r ON r.key=u.role WHERE u.status='active' AND (u.role='superuser' OR COALESCE((r.permissions->>'equipment')::integer,0)>=3) LIMIT 1;
 IF actor_id IS NULL THEN RAISE EXCEPTION 'Test needs an equipment administrator'; END IF;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor_id,'role','authenticated')::text,true);
 EXECUTE 'SET LOCAL ROLE authenticated';
 INSERT INTO public.equipment_items(name,category,type,purchase_price,weight_kg,width_cm,height_cm,length_cm,photo_path) VALUES('__dimensions_test__','Тест','Тест',123.45,12.5,100,50,40,'test-photo.jpg') RETURNING id INTO equipment;
 IF (SELECT volume_m3 FROM public.equipment_items WHERE id=equipment) IS DISTINCT FROM 0.2::numeric THEN RAISE EXCEPTION 'cm to cubic metre conversion is wrong'; END IF;
 UPDATE public.equipment_items SET width_cm=200 WHERE id=equipment;
 IF (SELECT volume_m3 FROM public.equipment_items WHERE id=equipment) IS DISTINCT FROM 0.4::numeric THEN RAISE EXCEPTION 'Volume did not recompute'; END IF;
 UPDATE public.equipment_items SET width_cm=NULL WHERE id=equipment;
 IF (SELECT volume_m3 FROM public.equipment_items WHERE id=equipment) IS NOT NULL THEN RAISE EXCEPTION 'Missing dimension must leave volume unknown'; END IF;
 denied:=false;BEGIN UPDATE public.equipment_items SET weight_kg=-1 WHERE id=equipment;EXCEPTION WHEN check_violation THEN denied:=true;END;
 IF NOT denied THEN RAISE EXCEPTION 'Negative weight allowed'; END IF;
 denied:=false;BEGIN UPDATE public.equipment_items SET purchase_price=-1 WHERE id=equipment;EXCEPTION WHEN check_violation THEN denied:=true;END;
 IF NOT denied THEN RAISE EXCEPTION 'Negative purchase price allowed'; END IF;
 UPDATE public.equipment_items SET photo_path=NULL WHERE id=equipment;
 DELETE FROM public.equipment_items WHERE id=equipment;
 EXECUTE 'RESET ROLE';
 IF (SELECT public FROM storage.buckets WHERE id='equipment-photos') IS DISTINCT FROM false THEN RAISE EXCEPTION 'Equipment photos must be private'; END IF;
END;
$$;
