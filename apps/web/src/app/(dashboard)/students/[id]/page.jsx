'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, GraduationCap } from 'lucide-react';
import { studentsApi } from '@/lib/api';
import { formatDate, getStatusColor, capitalize } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function StudentDetailPage() {
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ['student', id],
    queryFn: async () => {
      const res = await studentsApi.get(id);
      return res.data.data;
    },
    enabled: !!id,
  });

  if (isLoading) return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-48 w-full" />
    </div>
  );

  const student = data;
  const cls = student?.classId;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{student?.firstName} {student?.lastName}</h1>
          <p className="text-muted-foreground text-sm">{student?.admissionNumber}</p>
        </div>
        <span className={`ml-auto text-sm px-3 py-1 rounded-full font-medium ${getStatusColor(student?.status)}`}>
          {capitalize(student?.status ?? '')}
        </span>
      </div>

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="fees">Fees</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Personal Information</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Full Name</span><span className="font-medium">{student?.firstName} {student?.lastName}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Admission No.</span><span className="font-mono">{student?.admissionNumber}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Gender</span><span className="capitalize">{student?.gender}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Date of Birth</span><span>{formatDate(student?.dateOfBirth)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Enrolled</span><span>{formatDate(student?.createdAt)}</span></div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Academic Information</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Class</span>
                  <span className="font-medium">{typeof cls === 'object' ? `${cls.name}${cls.stream ? ` ${cls.stream}` : ''}` : '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Level</span>
                  <span>{typeof cls === 'object' ? cls.levelCategory : '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Academic Year</span>
                  <span>{typeof cls === 'object' ? cls.academicYear : '—'}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="fees">
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <GraduationCap className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p>Fee details available in the Fees section.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attendance">
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <p>Attendance summary coming soon.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
