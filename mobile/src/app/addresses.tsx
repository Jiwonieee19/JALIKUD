import { useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/auth-context';
import { useCustomerOrder } from '@/context/customer-order-context';
import { errorMessage } from '@/lib/api';
import { customerApi } from '@/lib/customer-api';

export default function AddressesScreen() {
  const router = useRouter(); const { token } = useAuth(); const { addresses, refreshAddresses } = useCustomerOrder();
  const [line1, setLine1] = useState(''); const [city, setCity] = useState(''); const [label, setLabel] = useState('Home');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function add() { if (!token || !line1.trim() || !city.trim()) return; setBusy(true); setError(''); try { await customerApi.createAddress(token, { label, line1, city, country: 'Philippines', is_default: addresses.length === 0 }); setLine1(''); setCity(''); await refreshAddresses(); } catch (caught) { setError(errorMessage(caught)); } finally { setBusy(false); } }
  async function makeDefault(id: number) { if (!token) return; setBusy(true); try { await customerApi.updateAddress(token, id, { is_default: true }); await refreshAddresses(); } catch (caught) { setError(errorMessage(caught)); } finally { setBusy(false); } }
  async function remove(id: number) { if (!token) return; setBusy(true); try { await customerApi.deleteAddress(token, id); await refreshAddresses(); } catch (caught) { setError(errorMessage(caught)); } finally { setBusy(false); } }
  return <SafeAreaView style={s.safe}><Stack.Screen options={{ headerShown: false }} /><View style={s.header}><Pressable onPress={() => router.back()}><Text style={s.back}>‹</Text></Pressable><Text style={s.title}>Saved Addresses</Text></View><ScrollView contentContainerStyle={s.content}>
    {addresses.map((address) => <View key={address.id} style={s.card}><Text style={s.cardTitle}>{address.label || 'Address'} {address.is_default ? '· Default' : ''}</Text><Text style={s.muted}>{address.line1}{address.line2 ? `, ${address.line2}` : ''}, {address.city}</Text><View style={s.actions}>{!address.is_default && <Pressable disabled={busy} onPress={() => void makeDefault(address.id)}><Text style={s.link}>Make default</Text></Pressable>}<Pressable disabled={busy} onPress={() => void remove(address.id)}><Text style={s.delete}>Delete</Text></Pressable></View></View>)}
    <View style={s.card}><Text style={s.cardTitle}>Add an address</Text><TextInput style={s.input} placeholder="Label" value={label} onChangeText={setLabel} /><TextInput style={s.input} placeholder="Street / address line" value={line1} onChangeText={setLine1} /><TextInput style={s.input} placeholder="City" value={city} onChangeText={setCity} />{!!error && <Text style={s.error}>{error}</Text>}<Pressable disabled={busy} onPress={() => void add()} style={s.button}>{busy ? <ActivityIndicator color="#FFF" /> : <Text style={s.buttonText}>Save Address</Text>}</Pressable></View>
  </ScrollView></SafeAreaView>;
}
const s = StyleSheet.create({ safe:{flex:1,backgroundColor:'#F4F4F6'},header:{backgroundColor:'#DC2626',flexDirection:'row',alignItems:'center',gap:12,padding:16},back:{color:'#FFF',fontSize:34,lineHeight:30},title:{color:'#FFF',fontSize:21,fontWeight:'900'},content:{padding:16,gap:12},card:{backgroundColor:'#FFF',borderRadius:14,padding:14,gap:9},cardTitle:{fontSize:15,fontWeight:'900',color:'#1C1C1E'},muted:{fontSize:12,color:'#74747C'},actions:{flexDirection:'row',gap:18},link:{color:'#2563EB',fontWeight:'700'},delete:{color:'#DC2626',fontWeight:'700'},input:{borderWidth:1,borderColor:'#E4E4E9',borderRadius:10,padding:11},button:{backgroundColor:'#DC2626',borderRadius:11,padding:14,alignItems:'center'},buttonText:{color:'#FFF',fontWeight:'900'},error:{color:'#B91C1C'} });